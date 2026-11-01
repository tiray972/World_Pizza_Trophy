// Réparation sélective d'une édition existante à partir d'une autre (tracée).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { repairEdition } from "@/lib/server/events/compare";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const body = await req.json();
    return NextResponse.json(
      await repairEdition(
        adminDB,
        {
          sourceId: String(body.sourceId || ""),
          targetId: String(body.targetId || ""),
          copyCategoryIds: Array.isArray(body.copyCategoryIds) ? body.copyCategoryIds.map(String) : [],
          remapProductIds: Array.isArray(body.remapProductIds) ? body.remapProductIds.map(String) : [],
        },
        { actor, reason: body.reason }
      )
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
