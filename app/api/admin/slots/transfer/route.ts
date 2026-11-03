// Transfert d'une réservation vers un autre créneau : identités, équipe et paiement suivent.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { transferSlotBooking } from "@/lib/server/slots/transfer";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const body = await req.json();
    return NextResponse.json(
      await transferSlotBooking(
        adminDB,
        { sourceSlotId: String(body.sourceSlotId || ""), targetSlotId: String(body.targetSlotId || "") },
        { actor, reason: body.reason }
      )
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
