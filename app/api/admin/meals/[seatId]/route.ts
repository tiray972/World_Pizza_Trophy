// Place repas : bénéficiaire (compléter un nom) et pointage de présence.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { updateSeat } from "@/lib/server/meals/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ seatId: string }> }) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { seatId } = await params;
    const body = await req.json();
    return NextResponse.json(
      await updateSeat(
        adminDB,
        {
          seatId,
          beneficiary: body.beneficiary === undefined ? undefined : body.beneficiary,
          present: typeof body.present === "boolean" ? body.present : undefined,
        },
        { actor, reason: body.reason }
      )
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
