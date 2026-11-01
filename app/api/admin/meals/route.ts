// Repas d'une édition : commandes, anomalies, et matérialisation d'une commande historique.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { materializeOrderSeats, mealOverview } from "@/lib/server/meals/service";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) throw new HttpError(400, "Édition manquante.");
    return NextResponse.json(await mealOverview(adminDB, eventId));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const body = await req.json();
    if (body.action !== "materialize" || !body.paymentId) throw new HttpError(400, "Action inconnue.");
    return NextResponse.json(await materializeOrderSeats(adminDB, String(body.paymentId), { actor, reason: body.reason }));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
