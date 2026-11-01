// Statut d'une édition : prérequis (GET), changement contrôlé et tracé, confirmation des prix (POST).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { changeEventStatus, confirmPricesReviewed, editionReadiness } from "@/lib/server/events/lifecycle";
import { EVENT_STATUS_ORDER } from "@/lib/domain/event-lifecycle";
import type { EventStatus } from "@/types/firestore";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { id } = await params;
    return NextResponse.json({ readiness: await editionReadiness(adminDB, id) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { id } = await params;
    const body = await req.json();
    if (body.action === "confirm-prices") {
      return NextResponse.json(await confirmPricesReviewed(adminDB, id, { actor, reason: body.reason }));
    }
    if (!EVENT_STATUS_ORDER.includes(body.to) || !EVENT_STATUS_ORDER.includes(body.expectedStatus)) throw new HttpError(400, "Statut invalide.");
    return NextResponse.json(
      await changeEventStatus(adminDB, { eventId: id, to: body.to as EventStatus, expectedStatus: body.expectedStatus as EventStatus }, { actor, reason: body.reason })
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
