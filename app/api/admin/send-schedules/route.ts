import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import {
  buildScheduleAudience,
  createMailTransport,
  renderScheduleEmail,
  SCHEDULE_SENDER,
} from "@/lib/email/schedule-mailing";

// Un lot d'emails par appel : l'interface enchaîne les appels. Évite de
// dépasser la durée maximale d'une fonction serverless avec 200 destinataires.
export const maxDuration = 60;
const BATCH_SIZE = 15;
const DELAY_BETWEEN_EMAILS_MS = 400; // ménage le serveur SMTP (limites Gmail)

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 🔒 Envoi en masse : administrateurs uniquement, vérifié côté serveur. */
async function requireAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization") || "";
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!idToken) throw Object.assign(new Error("Authentification requise."), { status: 401 });

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    throw Object.assign(new Error("Session expirée, reconnectez-vous."), { status: 401 });
  }

  const userDoc = await adminDB.collection("users").doc(decoded.uid).get();
  const isAdmin = decoded.role === "admin" || userDoc.data()?.role === "admin";
  if (!isAdmin) throw Object.assign(new Error("Réservé aux administrateurs."), { status: 403 });

  return { uid: decoded.uid, email: decoded.email || userDoc.data()?.email || "" };
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    const body = (await req.json()) as {
      eventId?: string;
      mode?: "preview" | "test" | "send";
      offset?: number;
      mailingId?: string;
    };

    const { eventId, mode = "preview" } = body;
    if (!eventId) return NextResponse.json({ error: "Événement manquant." }, { status: 400 });

    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const audience = await buildScheduleAudience(eventId);
    const accountUrl = (lang: string) => `${origin}/${lang}/account`;

    // ---------------------------------------------------------------- Aperçu
    if (mode === "preview") {
      const first = audience.recipients[0];
      const lastMailingSnapshot = await adminDB
        .collection("scheduleMailings")
        .where("eventId", "==", eventId)
        .get();
      const lastMailing = lastMailingSnapshot.docs
        .map(doc => doc.data())
        .sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0))[0];

      return NextResponse.json({
        eventName: audience.eventName,
        recipientCount: audience.recipients.length,
        participantCount: audience.participantCount,
        skipped: audience.skipped,
        sample: first
          ? { to: first.email, ...renderScheduleEmail(first, audience.eventName, accountUrl(first.lang)) }
          : null,
        lastMailing: lastMailing
          ? {
              startedAt: lastMailing.startedAt?.toDate?.().toISOString() || null,
              sent: lastMailing.sent || 0,
              failed: lastMailing.failed || 0,
              total: lastMailing.total || 0,
              status: lastMailing.status || "",
            }
          : null,
      });
    }

    const transport = createMailTransport();

    // ------------------------------------------------- Test sur l'adresse admin
    if (mode === "test") {
      const first = audience.recipients[0];
      if (!first) return NextResponse.json({ error: "Aucun participant à qui envoyer un programme." }, { status: 400 });
      if (!adminUser.email) return NextResponse.json({ error: "Votre compte n'a pas d'adresse email." }, { status: 400 });

      const email = renderScheduleEmail(first, audience.eventName, accountUrl(first.lang));
      await transport.sendMail({
        from: SCHEDULE_SENDER(),
        to: adminUser.email,
        subject: `[TEST] ${email.subject}`,
        html: email.html,
        text: email.text,
      });
      return NextResponse.json({ sentTo: adminUser.email, previewOf: first.email });
    }

    // ------------------------------------------------------- Envoi par lots
    const offset = Math.max(0, Number(body.offset) || 0);
    let mailingRef: admin.firestore.DocumentReference;
    let recipientEmails: string[];

    if (offset === 0 || !body.mailingId) {
      // Liste figée au premier lot : si quelqu'un s'inscrit pendant l'envoi,
      // l'ordre ne bouge pas et personne n'est sauté ni servi deux fois.
      recipientEmails = audience.recipients.map(recipient => recipient.email);
      mailingRef = adminDB.collection("scheduleMailings").doc();
      await mailingRef.set({
        eventId,
        startedAt: admin.firestore.Timestamp.now(),
        startedBy: adminUser.uid,
        total: recipientEmails.length,
        recipientEmails,
        sent: 0,
        failed: 0,
        failures: [],
        status: "running",
      });
    } else {
      mailingRef = adminDB.collection("scheduleMailings").doc(body.mailingId);
      const mailingDoc = await mailingRef.get();
      if (!mailingDoc.exists) return NextResponse.json({ error: "Envoi introuvable." }, { status: 404 });
      recipientEmails = mailingDoc.data()?.recipientEmails || [];
    }

    const batch = recipientEmails.slice(offset, offset + BATCH_SIZE);
    const byEmail = new Map(audience.recipients.map(recipient => [recipient.email, recipient]));
    let sent = 0;
    const failures: { email: string; error: string }[] = [];

    for (const [index, email] of batch.entries()) {
      const recipient = byEmail.get(email);
      if (!recipient) continue; // plus aucun passage confirmé depuis le début de l'envoi

      try {
        const content = renderScheduleEmail(recipient, audience.eventName, accountUrl(recipient.lang));
        await transport.sendMail({
          from: SCHEDULE_SENDER(),
          to: recipient.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
        sent++;
      } catch (error) {
        failures.push({ email, error: error instanceof Error ? error.message : String(error) });
      }
      if (index < batch.length - 1) await sleep(DELAY_BETWEEN_EMAILS_MS);
    }

    const nextOffset = offset + batch.length < recipientEmails.length ? offset + batch.length : null;

    await mailingRef.update({
      sent: admin.firestore.FieldValue.increment(sent),
      failed: admin.firestore.FieldValue.increment(failures.length),
      ...(failures.length > 0 ? { failures: admin.firestore.FieldValue.arrayUnion(...failures) } : {}),
      ...(nextOffset === null ? { status: "done", finishedAt: admin.firestore.Timestamp.now() } : {}),
    });

    return NextResponse.json({
      mailingId: mailingRef.id,
      total: recipientEmails.length,
      sent,
      failures,
      nextOffset,
    });
  } catch (error) {
    const status = (error as { status?: number })?.status || 500;
    console.error("❌ [send-schedules]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne." },
      { status }
    );
  }
}
