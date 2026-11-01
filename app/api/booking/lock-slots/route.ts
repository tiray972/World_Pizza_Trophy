// Ancienne route : verrouillait n'importe quel créneau (même payé) pour
// n'importe quel appelant. Le verrouillage est désormais fait uniquement par
// le paiement, dans une transaction (lib/server/booking/checkout-service.ts).
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Route retirée." }, { status: 410 });
}
