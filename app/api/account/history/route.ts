// Historique sportif du compte connecté (ou d'un compte consulté par un administrateur).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { accountHistory } from "@/lib/server/participants/history";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireUser(req.headers, { auth: adminAuth, db: adminDB });
    const requested = req.nextUrl.searchParams.get("uid");
    if (requested && requested !== actor.uid && !actor.isAdmin) throw new HttpError(403, "Accès refusé.");
    return NextResponse.json({ editions: await accountHistory(adminDB, requested || actor.uid) });
  } catch (error) {
    return errorResponse(error);
  }
}
