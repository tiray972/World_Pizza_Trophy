// Résultats d'une édition (admin) : lecture des brouillons, import, validation, publication.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { buildIdentityIndex, publishResultSet, saveResultDraft, validateResultSet } from "@/lib/server/results/service";
import { displayName } from "@/lib/domain/names";
import { draftsFromSnapshot2026 } from "@/lib/server/results/import-snapshot";
import { parseResultsCsv } from "@/lib/domain/results";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) throw new HttpError(400, "Édition manquante.");
    const [sets, index] = await Promise.all([adminDB.collection("resultSets").where("eventId", "==", eventId).get(), buildIdentityIndex(adminDB, eventId)]);
    return NextResponse.json({
      // Identités proposées pour un choix manuel (revalidé par le serveur à l'enregistrement).
      identities: index
        .filter(entry => !entry.withdrawn)
        .map(entry => ({ id: entry.id, kind: entry.kind, bib: entry.bib, categoryIds: entry.categoryIds, label: entry.displayName || entry.names.map(displayName).join(" – ") }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr")),
      sets: sets.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, categoryKey: data.categoryKey, categoryName: data.categoryName, categoryId: data.categoryId, kind: data.kind,
          status: data.status, isPublished: !!data.isPublished, draftVersion: data.draftVersion,
          publishedVersion: data.published?.version ?? null, draft: data.draft ?? null,
        };
      }).sort((a, b) => a.categoryName.localeCompare(b.categoryName, "fr")),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const body = await req.json();
    const context = { actor, reason: body.reason };
    switch (body.action) {
      case "import-snapshot-2026": {
        const drafts = await draftsFromSnapshot2026(adminDB, String(body.eventId));
        const results = [];
        for (const draft of drafts) results.push({ categoryKey: draft.categoryKey, ...(await saveResultDraft(adminDB, draft, context)) });
        return NextResponse.json({ imported: results.map(result => ({ categoryKey: result.categoryKey, blocking: result.blocking.length, warnings: result.warnings.length })) });
      }
      case "draft": {
        const lines = typeof body.csv === "string" ? parseResultsCsv(body.csv) : { lines: body.lines ?? [], errors: [] };
        if (lines.errors.length) throw new HttpError(400, lines.errors.join(" "));
        return NextResponse.json(
          await saveResultDraft(adminDB, {
            eventId: String(body.eventId), categoryKey: String(body.categoryKey), categoryId: body.categoryId ?? null,
            categoryName: String(body.categoryName ?? body.categoryKey), kind: body.kind === "team" ? "team" : "individual",
            lines: lines.lines, confirmedLines: Array.isArray(body.confirmedLines) ? body.confirmedLines.map(Number) : [],
            manualMatches: body.manualMatches ?? undefined, source: String(body.source ?? "saisie admin"),
          }, context)
        );
      }
      case "validate":
        return NextResponse.json(await validateResultSet(adminDB, { id: String(body.id), expectedDraftVersion: Number(body.expectedDraftVersion) }, context));
      case "publish":
        return NextResponse.json(await publishResultSet(adminDB, { id: String(body.id) }, context));
      default:
        throw new HttpError(400, "Action inconnue.");
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
