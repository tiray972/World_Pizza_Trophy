import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import * as admin from "firebase-admin";

/**
 * Efface les données de participant restées collées à des créneaux
 * redevenus disponibles (réservation commencée puis abandonnée).
 *
 * Les affichages ignorent déjà ces données, mais elles restent en base :
 * cette route les supprime définitivement.
 */
export async function POST(req: NextRequest) {
    try {
        const authorization = req.headers.get("authorization") || "";
        const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
        if (!idToken) {
            return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
        }
        try {
            await adminAuth.verifyIdToken(idToken);
        } catch {
            return NextResponse.json({ error: "Session expirée." }, { status: 401 });
        }

        const { eventId } = (await req.json()) as { eventId?: string };
        if (!eventId) {
            return NextResponse.json({ error: "Événement manquant." }, { status: 400 });
        }

        const snapshot = await adminDB
            .collection("slots")
            .where("eventId", "==", eventId)
            .where("status", "==", "available")
            .get();

        const batch = adminDB.batch();
        let cleanedCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const hasResidue =
                data.participant ||
                (Array.isArray(data.participants) && data.participants.length > 0) ||
                data.buyerId ||
                data.lockedByUserId ||
                data.lockedUntil ||
                data.stripeSessionId;

            if (!hasResidue) return;

            batch.update(doc.ref, {
                participant: admin.firestore.FieldValue.delete(),
                participants: admin.firestore.FieldValue.delete(),
                buyerId: admin.firestore.FieldValue.delete(),
                lockedByUserId: admin.firestore.FieldValue.delete(),
                lockedUntil: admin.firestore.FieldValue.delete(),
                stripeSessionId: null,
            });
            cleanedCount++;
        });

        if (cleanedCount > 0) {
            await batch.commit();
        }

        console.log(`🧹 [cleanup-orphan-participants] ${cleanedCount} créneau(x) nettoyé(s)`);
        return NextResponse.json({ cleanedCount });
    } catch (error) {
        console.error("❌ [cleanup-orphan-participants] Erreur:", error);
        return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
    }
}
