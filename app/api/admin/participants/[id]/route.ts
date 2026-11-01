// Correction d'un participant : nom, dossard, retrait du planning.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { assignBib, renameParticipant, setWithdrawn } from "@/lib/server/participants/service";
import { adminErrorResponse } from "@/lib/server/participants/routes";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { id } = await params;
    const body = await req.json();
    const context = { actor, reason: body.reason };
    const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : undefined;

    switch (body.action) {
      case "rename":
        return NextResponse.json(
          await renameParticipant(adminDB, { participantId: id, firstName: String(body.firstName ?? ""), lastName: String(body.lastName ?? ""), expectedVersion }, context)
        );
      case "bib":
        return NextResponse.json(
          await assignBib(adminDB, { holderType: "participant", holderId: id, bib: body.bib === null ? null : Number(body.bib), expectedVersion }, context)
        );
      case "withdraw":
        return NextResponse.json(await setWithdrawn(adminDB, { participantId: id, withdrawn: !!body.withdrawn, expectedVersion }, context));
      default:
        throw new HttpError(400, "Action inconnue.");
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
