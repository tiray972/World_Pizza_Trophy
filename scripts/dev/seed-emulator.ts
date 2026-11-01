// Données de démonstration pour l'émulateur (jamais pour la production).
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx vite-node --config vitest.config.ts scripts/dev/seed-emulator.ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Réservé à l'émulateur : FIRESTORE_EMULATOR_HOST absent.");
const db = getFirestore(initializeApp({ projectId: "demo-wpt" }));
const at = Timestamp.now();
const published = (categoryId: string, texts: Record<string, string>) => ({
  published: { version: 2, versionId: `${categoryId}_v2`, texts, referenceLang: "fr", publishedAt: at, publishedBy: "admin", publishedByName: "Organisation WPT" },
});

async function main() {
  await db.collection("events").doc("demo2027").set({
    name: "World Pizza Trophy 2027 (démo)", eventYear: 2027, status: "open", mealPrice: 30, minSlotsPerBooking: 1, rulesAcceptanceRequired: true,
    eventStartDate: Timestamp.fromDate(new Date("2027-10-26T07:00:00Z")), eventEndDate: Timestamp.fromDate(new Date("2027-10-27T17:00:00Z")),
    registrationDeadline: Timestamp.fromDate(new Date("2027-10-20T21:00:00Z")),
  });
  const longFr = ["## Préparation", ...Array.from({ length: 14 }, (_, index) => `- Point ${index + 1} du règlement : texte de démonstration suffisamment long pour vérifier le défilement sur mobile.`), "", "## Jury", "Le jury note la cuisson, le goût et la présentation. <script>alert('x')</script> reste affiché comme du texte."].join("\n");
  await db.collection("categories").doc("demo-classique").set({
    eventId: "demo2027", name: "Pizza Classique", nameI18n: { en: "Classic Pizza", es: "Pizza Clásica", it: "Pizza Classica" }, description: "Catégorie de démonstration",
    unitPrice: 70, maxSlots: 20, durationMinutes: 15, activeDates: ["2027-10-26"], isActive: true, participantsPerSlot: 1,
    rulesI18n: published("demo-classique", { fr: longFr, en: "## Preparation\n- Demo rule in English.", it: "## Preparazione\n- Regola dimostrativa." }),
  });
  await db.collection("categories").doc("demo-due").set({
    eventId: "demo2027", name: "Pizza Due", description: "Duo", unitPrice: 120, maxSlots: 10, durationMinutes: 20, activeDates: ["2027-10-26"], isActive: true, participantsPerSlot: 2,
    rulesI18n: published("demo-due", { fr: "## Équipe\n- Deux pizzaïolos par créneau." }),
  });
  await db.collection("categories").doc("demo-pala").set({
    eventId: "demo2027", name: "Pala", description: "Sans règlement publié", unitPrice: 70, maxSlots: 10, durationMinutes: 15, activeDates: ["2027-10-26"], isActive: true,
  });
  for (const [index, categoryId] of ["demo-classique", "demo-classique", "demo-due", "demo-pala"].entries()) {
    const start = new Date(Date.UTC(2027, 9, 26, 8 + index, 0));
    await db.collection("slots").doc(`demo-slot-${index}`).set({
      eventId: "demo2027", categoryId, date: "2027-10-26", status: "available", stripeSessionId: null,
      startTime: Timestamp.fromDate(start), endTime: Timestamp.fromDate(new Date(start.getTime() + 15 * 60000)),
    });
  }
  console.log("✅ Données de démonstration écrites dans l'émulateur.");
}
main();
