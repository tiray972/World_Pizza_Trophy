import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { TEST_PROJECT_ID } from "../helpers/emulator";

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8085").split(":");
  env = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: { rules: readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "users/admin1"), { role: "admin", email: "admin@example.test" });
    await setDoc(doc(db, "users/buyer1"), { role: "user", email: "buyer1@example.test", registrations: {} });
    await setDoc(doc(db, "users/buyer2"), { role: "user", email: "buyer2@example.test" });
    await setDoc(doc(db, "events/evt"), { name: "WPT 2027", status: "open" });
    await setDoc(doc(db, "categories/classique"), { eventId: "evt", name: "Classique", rulesI18n: { published: { version: 1 } } });
    await setDoc(doc(db, "slots/s1"), { eventId: "evt", status: "paid", buyerId: "buyer1", participants: [{ firstName: "Kévin", lastName: "PROSPER", phone: "06…" }] });
    await setDoc(doc(db, "payments/cs_1"), { userId: "buyer1", eventId: "evt", amount: 140, stripeSessionId: "cs_1", status: "paid" });
    await setDoc(doc(db, "participants/p1"), { eventId: "evt", firstName: "Kévin", lastName: "PROSPER", version: 1 });
  });
});

const anonymous = () => env.unauthenticatedContext().firestore();
const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("règles Firestore", () => {
  it("catalogue public, sans donnée personnelle des candidats", async () => {
    await assertSucceeds(getDoc(doc(anonymous(), "events/evt")));
    await assertSucceeds(getDoc(doc(anonymous(), "categories/classique")));
    await assertFails(getDoc(doc(anonymous(), "slots/s1")));
    await assertFails(getDocs(query(collection(anonymous(), "slots"), where("eventId", "==", "evt"))));
    await assertFails(getDoc(doc(as("buyer2"), "slots/s1")));
  });

  it("un acheteur lit ses créneaux et paiements, pas ceux des autres", async () => {
    await assertSucceeds(getDocs(query(collection(as("buyer1"), "slots"), where("buyerId", "==", "buyer1"))));
    await assertSucceeds(getDocs(query(collection(as("buyer1"), "payments"), where("userId", "==", "buyer1"))));
    await assertFails(getDocs(query(collection(as("buyer2"), "payments"), where("userId", "==", "buyer1"))));
    await assertFails(getDoc(doc(as("buyer2"), "users/buyer1")));
  });

  it("personne ne se donne le rôle admin ni ne modifie ses inscriptions", async () => {
    await assertFails(updateDoc(doc(as("buyer1"), "users/buyer1"), { role: "admin" }));
    await assertFails(updateDoc(doc(as("buyer1"), "users/buyer1"), { registrations: { evt: { paid: true } } }));
    await assertFails(setDoc(doc(as("buyer2"), "users/buyer3"), { role: "admin" }));
  });

  it("un visiteur ne peut ni réserver, ni payer, ni modifier un créneau ou un prix", async () => {
    await assertFails(updateDoc(doc(as("buyer2"), "slots/s1"), { buyerId: "buyer2" }));
    await assertFails(setDoc(doc(as("buyer2"), "payments/fake"), { userId: "buyer2", status: "paid" }));
    await assertFails(updateDoc(doc(as("buyer2"), "categories/classique"), { unitPrice: 1 }));
    await assertFails(updateDoc(doc(anonymous(), "events/evt"), { status: "archived" }));
  });

  it("identités, équipes, places repas et journaux : serveur uniquement", async () => {
    await assertFails(updateDoc(doc(as("admin1"), "participants/p1"), { lastName: "X" }));
    await assertFails(setDoc(doc(as("admin1"), "mealSeats/x"), { paymentId: "cs_1" }));
    await assertFails(setDoc(doc(as("admin1"), "auditLogs/x"), { action: "fake" }));
    await assertFails(getDoc(doc(as("buyer1"), "participants/p1")));
    await assertSucceeds(getDoc(doc(as("admin1"), "participants/p1")));
  });

  it("l'admin gère la configuration mais ne réécrit ni règlement publié ni montant payé", async () => {
    await assertSucceeds(updateDoc(doc(as("admin1"), "categories/classique"), { unitPrice: 80 }));
    await assertFails(updateDoc(doc(as("admin1"), "categories/classique"), { "rulesI18n.published.version": 9 }));
    await assertSucceeds(updateDoc(doc(as("admin1"), "payments/cs_1"), { status: "refunded" }));
    await assertFails(updateDoc(doc(as("admin1"), "payments/cs_1"), { amount: 0 }));
    await assertSucceeds(updateDoc(doc(as("admin1"), "slots/s1"), { status: "offered" }));
  });

  it("statut d'édition : uniquement par le serveur ; création en brouillon seulement", async () => {
    await assertFails(updateDoc(doc(as("admin1"), "events/evt"), { status: "archived" }));
    await assertSucceeds(updateDoc(doc(as("admin1"), "events/evt"), { name: "WPT 2027 (renommée)", status: "open" }));
    await assertFails(setDoc(doc(as("admin1"), "events/new"), { name: "X", status: "open" }));
    await assertSucceeds(setDoc(doc(as("admin1"), "events/new"), { name: "X", status: "draft" }));
  });

  it("mesure d'audience : écriture anonyme limitée, lecture admin", async () => {
    await assertSucceeds(addDoc(collection(anonymous(), "pageViews"), { path: "/fr", sessionId: "s", timestamp: serverTimestamp(), userId: null }));
    await assertFails(addDoc(collection(anonymous(), "pageViews"), { path: "/fr", role: "admin" }));
    await assertFails(getDocs(collection(anonymous(), "pageViews")));
  });
});
