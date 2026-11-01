// app/api/booking/checkout-pack/route.ts
// Paiement d'un pack : le prix et le contenu viennent du produit en base,
// jamais du navigateur (lib/server/booking/checkout-service.ts).

import { NextRequest } from "next/server";
import { handleCheckoutRequest } from "@/lib/server/booking/checkout-route";
import type { CheckoutInput } from "@/lib/server/booking/checkout-service";

export async function POST(req: NextRequest) {
  return handleCheckoutRequest(req, body => ({
    eventId: String(body.eventId || ""),
    slots: (Array.isArray(body.slotsToReserve) ? body.slotsToReserve : []) as CheckoutInput["slots"],
    mealGuests: (Array.isArray(body.mealGuests) ? body.mealGuests : []) as CheckoutInput["mealGuests"],
    pack: { productId: String(body.packId || ""), quantity: typeof body.quantity === "number" ? body.quantity : undefined },
    ruleAcceptances: (Array.isArray(body.ruleAcceptances) ? body.ruleAcceptances : []) as CheckoutInput["ruleAcceptances"],
  }));
}
