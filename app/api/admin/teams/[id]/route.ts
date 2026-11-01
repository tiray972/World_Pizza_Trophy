// Équipe : membres (complétion d'un équipier) et dossard d'équipe.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { assignBib, setTeamMembers } from "@/lib/server/participants/service";
import { adminErrorResponse } from "@/lib/server/participants/routes";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { id } = await params;
    const body = await req.json();
    const context = { actor, reason: body.reason };
    const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : undefined;

    switch (body.action) {
      case "members":
        if (!Array.isArray(body.memberIds)) throw new HttpError(400, "Membres manquants.");
        return NextResponse.json(await setTeamMembers(adminDB, { teamId: id, memberIds: body.memberIds.map(String), expectedVersion }, context));
      case "bib":
        return NextResponse.json(
          await assignBib(adminDB, { holderType: "team", holderId: id, bib: body.bib === null ? null : Number(body.bib), expectedVersion }, context)
        );
      default:
        throw new HttpError(400, "Action inconnue.");
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
