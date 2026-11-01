// Attribution manuelle de créneaux (offert ou rattaché à un paiement réel), duo compris.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { assignSlotsManually, type ManualAssignmentInput } from "@/lib/server/slots/assign";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const body = (await req.json()) as Partial<ManualAssignmentInput> & { reason?: string };
    return NextResponse.json(
      await assignSlotsManually(
        adminDB,
        {
          eventId: String(body.eventId || ""),
          requestId: String(body.requestId || ""),
          buyerId: body.buyerId ? String(body.buyerId) : null,
          status: body.status === "paid" ? "paid" : "offered",
          paymentId: body.paymentId ? String(body.paymentId) : null,
          assignments: Array.isArray(body.assignments) ? body.assignments : [],
        },
        { actor, reason: body.reason }
      )
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
