// « Préparer une nouvelle édition à partir de… » : aperçu (GET) et création en brouillon (POST).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { duplicateEdition, previewDuplication, resumeDuplication, type DuplicationInput } from "@/lib/server/events/duplicate";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const sourceEventId = req.nextUrl.searchParams.get("sourceEventId");
    if (!sourceEventId) throw new HttpError(400, "Édition source manquante.");
    return NextResponse.json(await previewDuplication(adminDB, sourceEventId));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const body = (await req.json()) as DuplicationInput & { resume?: boolean };
    const input: DuplicationInput = {
      sourceEventId: String(body.sourceEventId || ""),
      requestId: String(body.requestId || ""),
      name: String(body.name || ""),
      eventYear: Number(body.eventYear),
      eventStartDate: String(body.eventStartDate || ""),
      eventEndDate: String(body.eventEndDate || ""),
      registrationDeadline: String(body.registrationDeadline || ""),
      dayMapping: Array.isArray(body.dayMapping) ? body.dayMapping.map(value => (value ? String(value) : null)) : [],
    };
    const result = body.resume ? await resumeDuplication(adminDB, input, { actor }) : await duplicateEdition(adminDB, input, { actor });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
