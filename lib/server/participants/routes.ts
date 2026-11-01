// lib/server/participants/routes.ts
// Réponses HTTP communes aux routes d'administration des participants.
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/server/auth";
import { ParticipantActionError } from "./service";

export function adminErrorResponse(error: unknown): NextResponse {
  if (error instanceof ParticipantActionError || error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error instanceof ParticipantActionError ? error.details : undefined },
      { status: error.status }
    );
  }
  console.error("❌ [admin] Erreur:", error);
  return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
}
