// Attribution d'un rôle : administrateurs uniquement, rôles connus uniquement.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { errorResponse, HttpError, requireAdmin } from "@/lib/server/auth";
import * as admin from "firebase-admin";

const ROLES = ["user", "admin", "jury"] as const;

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { uid, role } = (await req.json()) as { uid?: string; role?: string };
    if (!uid || !ROLES.includes(role as (typeof ROLES)[number])) {
      throw new HttpError(400, "Compte ou rôle invalide.");
    }
    const userRef = adminDB.collection("users").doc(uid);
    const before = (await userRef.get()).data()?.role ?? null;
    await adminAuth.setCustomUserClaims(uid, { role });
    await userRef.set({ role }, { merge: true });
    await adminDB.collection("auditLogs").add({
      entity: "user",
      entityId: uid,
      action: "role.set",
      actorUid: actor.uid,
      actorName: actor.displayName,
      before: { role: before },
      after: { role },
      at: admin.firestore.Timestamp.now(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
