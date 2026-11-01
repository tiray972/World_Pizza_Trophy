// app/api/booking/checkout/route.ts
// Paiement de créneaux et/ou de repas. Prix, édition, disponibilité et
// règlements sont vérifiés côté serveur (lib/server/booking/checkout-service.ts).

import { NextRequest } from "next/server";
import { handleCheckoutRequest } from "@/lib/server/booking/checkout-route";
import type { CheckoutInput } from "@/lib/server/booking/checkout-service";

export async function POST(req: NextRequest) {
  return handleCheckoutRequest(req, body => ({
    eventId: String(body.eventId || ""),
    slots: (Array.isArray(body.slotsToReserve) ? body.slotsToReserve : []) as CheckoutInput["slots"],
    mealGuests: (body.includeMeal && Array.isArray(body.mealGuests) ? body.mealGuests : []) as CheckoutInput["mealGuests"],
    ruleAcceptances: (Array.isArray(body.ruleAcceptances) ? body.ruleAcceptances : []) as CheckoutInput["ruleAcceptances"],
    clientTotal: typeof body.totalAmount === "number" ? body.totalAmount : undefined,
  }));
}
