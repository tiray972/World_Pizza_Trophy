// Participants d'une édition (lecture admin) et ajout manuel.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { createParticipant } from "@/lib/server/participants/service";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { listEventIdentities } from "@/lib/server/participants/overview";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) throw new HttpError(400, "Édition manquante.");
    return NextResponse.json(await listEventIdentities(adminDB, eventId));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const body = await req.json();
    const result = await createParticipant(
      adminDB,
      {
        eventId: String(body.eventId || ""),
        firstName: String(body.firstName || ""),
        lastName: String(body.lastName || ""),
        requestId: String(body.requestId || ""),
        shirtSize: body.shirtSize || undefined,
        note: body.note || undefined,
      },
      { actor, reason: body.reason }
    );
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
