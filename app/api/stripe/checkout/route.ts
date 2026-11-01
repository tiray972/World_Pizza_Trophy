// Ancienne route inutilisée (prix Stripe libre, sans contrôle). Les paiements
// passent par /api/booking/checkout et /api/booking/checkout-pack.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Route retirée." }, { status: 410 });
}
