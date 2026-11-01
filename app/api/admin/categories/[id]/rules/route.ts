// Règlement d'une catégorie : enregistrer le brouillon (PUT), publier une version (POST).
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/server/auth";
import { adminErrorResponse } from "@/lib/server/participants/routes";
import { publishRules, saveRulesDraft } from "@/lib/server/rules/publish";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { id } = await params;
    const body = await req.json();
    return NextResponse.json(await saveRulesDraft(adminDB, { categoryId: id, texts: body.texts ?? {}, nameI18n: body.nameI18n ?? {} }, { actor }));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireAdmin(req.headers, { auth: adminAuth, db: adminDB });
    const { id } = await params;
    const body = await req.json();
    return NextResponse.json(
      await publishRules(adminDB, { categoryId: id, expectedPublishedVersion: Number(body.expectedPublishedVersion ?? 0) }, { actor, reason: body.reason })
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
