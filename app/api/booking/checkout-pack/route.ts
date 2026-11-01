// app/api/booking/checkout-pack/route.ts
// Paiement d'un pack : le prix et le contenu viennent du produit en base,
// jamais du navigateur (lib/server/booking/checkout-service.ts).

import { NextRequest } from "next/server";
import { handleCheckoutRequest } from "@/lib/server/booking/checkout-route";

export async function POST(req: NextRequest) {
  return handleCheckoutRequest(req, body => ({
    eventId: String(body.eventId || ""),
    slots: Array.isArray(body.slotsToReserve) ? body.slotsToReserve : [],
    mealGuests: Array.isArray(body.mealGuests) ? body.mealGuests : [],
    pack: { productId: String(body.packId || ""), quantity: body.quantity },
    ruleAcceptances: Array.isArray(body.ruleAcceptances) ? body.ruleAcceptances : [],
  }));
}
