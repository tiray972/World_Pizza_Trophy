// Disponibilité publique des créneaux d'une édition ouverte.
// Ne renvoie AUCUNE donnée personnelle (noms, emails, téléphones restent sur
// les créneaux, lisibles seulement par leur acheteur et les administrateurs).
import { NextRequest, NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase/admin";
import { toDateOrNull } from "@/lib/domain/event-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "Édition manquante." }, { status: 400 });

  const event = await adminDB.collection("events").doc(eventId).get();
  if (!event.exists || event.data()?.status !== "open") {
    return NextResponse.json({ error: "Cette édition n'est pas ouverte aux inscriptions.", code: "event_not_open" }, { status: 404 });
  }
  const now = Date.now();
  const snapshot = await adminDB.collection("slots").where("eventId", "==", eventId).get();
  const slots = snapshot.docs.map(doc => {
    const data = doc.data();
    const lockExpired = data.status === "locked" && (toDateOrNull(data.lockedUntil)?.getTime() ?? 0) < now;
    return {
      id: doc.id,
      eventId,
      categoryId: data.categoryId,
      date: data.date,
      startTime: toDateOrNull(data.startTime)?.toISOString() ?? null,
      endTime: toDateOrNull(data.endTime)?.toISOString() ?? null,
      // Un verrou expiré redevient réservable : le paiement le revérifie de toute façon.
      status: lockExpired ? "available" : data.status === "available" ? "available" : "unavailable",
    };
  });
  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
