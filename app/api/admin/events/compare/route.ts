// Diagnostic comparatif de deux éditions (lecture seule).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { HttpError, requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { compareEditions } from "@/lib/server/events/compare";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const source = req.nextUrl.searchParams.get("source");
    const target = req.nextUrl.searchParams.get("target");
    if (!source || !target || source === target) throw new HttpError(400, "Deux éditions différentes sont nécessaires.");
    return NextResponse.json(await compareEditions(adminDB, source, target));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
