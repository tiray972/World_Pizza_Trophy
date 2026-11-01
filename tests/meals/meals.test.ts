import { describe, expect, it } from "vitest";
import { attendanceSheet, buildMealOrders, mealTotals, type PaymentView, type SeatView } from "@/lib/domain/meals";
import { UNNAMED_PACK_MEAL } from "@/lib/booking/packs";

const payment = (id: string, overrides: Partial<PaymentView> = {}): PaymentView => ({
  id,
  userId: "buyer1",
  stripeSessionId: `cs_${id}`,
  status: "paid",
  amount: 0,
  createdAt: new Date("2026-10-19T13:55:51Z"),
  isPack: false,
  metadata: {},
  ...overrides,
});

const label = (id: string) => ({ buyer1: "MALTESE Giovanni", buyer2: "FAGNANI Francesco", buyer3: "POSITANO" } as Record<string, string>)[id] ?? id;

describe("commandes de repas", () => {
  it("session enregistrée deux fois (cas MALTESE) : un seul repas, doublon signalé, rien supprimé", () => {
    const meta = { mealGuests: JSON.stringify([{ firstName: "GIOVANNI", lastName: "MALTESE" }]), mealQuantity: "1", mealPrice: "30" };
    const first = payment("a", { stripeSessionId: "cs_b1dadj", metadata: meta });
    const second = payment("b", { stripeSessionId: "cs_b1dadj", metadata: meta });

    const { orders, anomalies } = buildMealOrders([first, second], [], label);

    expect(mealTotals(orders).paidSeats).toBe(1);
    expect(anomalies).toEqual([expect.objectContaining({ kind: "duplicate_payment_record", paymentId: "b" })]);
  });

  it("trois places au même nom (cas FAGNANI) restent trois places", () => {
    const meta = {
      mealGuests: JSON.stringify(Array.from({ length: 3 }, () => ({ firstName: "Francesco", lastName: "FAGNANI" }))),
      mealQuantity: "3",
      mealPrice: "30",
    };
    const { orders } = buildMealOrders([payment("f", { userId: "buyer2", metadata: meta })], [], label);
    expect(mealTotals(orders)).toMatchObject({ paidSeats: 3, namedSeats: 3 });
    expect(attendanceSheet(orders).map(row => row.seatNumber)).toEqual(["1/3", "2/3", "3/3"]);
  });

  it("achats séparés d'un même acheteur : commandes distinctes, aucun regroupement sur le nom", () => {
    const meta = { mealGuests: JSON.stringify([{ firstName: "Léa", lastName: "Martin" }]), mealQuantity: "1", mealPrice: "30" };
    const { orders } = buildMealOrders([payment("x", { metadata: meta }), payment("y", { metadata: meta })], [], label);
    expect(orders).toHaveLength(2);
    expect(mealTotals(orders)).toMatchObject({ orders: 2, buyers: 1, paidSeats: 2 });
  });

  it("pack sans noms : places « à compléter », jamais le nom de l'acheteur", () => {
    const meta = { mealGuests: JSON.stringify([{ ...UNNAMED_PACK_MEAL }, { ...UNNAMED_PACK_MEAL }]), mealQuantity: "2", mealPrice: "0" };
    const { orders, anomalies } = buildMealOrders([payment("p", { userId: "buyer3", isPack: true, metadata: meta })], [], label);
    const rows = attendanceSheet(orders);
    expect(rows.map(row => row.label)).toEqual(["Place à compléter", "Place à compléter"]);
    expect(rows.every(row => row.buyerLabel === "POSITANO")).toBe(true);
    expect(anomalies).toEqual([expect.objectContaining({ kind: "missing_names" })]);
  });

  it("commande remboursée, en attente ou échouée : absente du pointage", () => {
    const meta = { mealGuests: JSON.stringify([{ firstName: "A", lastName: "B" }]), mealQuantity: "1", mealPrice: "30" };
    const { orders } = buildMealOrders(
      [payment("r", { status: "refunded", metadata: meta }), payment("w", { status: "pending", metadata: meta }), payment("ok", { metadata: meta })],
      [],
      label
    );
    expect(attendanceSheet(orders)).toHaveLength(1);
    expect(mealTotals(orders).paidSeats).toBe(1);
  });

  it("places réelles prioritaires sur la reconstitution historique", () => {
    const seats: SeatView[] = [0, 1].map(seatIndex => ({
      id: `cs_n_m${seatIndex + 1}`, paymentId: "n", stripeSessionId: "cs_n", buyerId: "buyer1", seatIndex, seatsInOrder: 2,
      beneficiary: seatIndex === 0 ? { firstName: "Kévin", lastName: "PROSPER" } : null,
      unitPrice: 30, includedInPack: false, financialStatus: "paid", present: seatIndex === 0, derived: false,
    }));
    const { orders } = buildMealOrders([payment("n", { mealSeatIds: seats.map(seat => seat.id), metadata: { mealQuantity: "5" } })], seats, label);
    const rows = attendanceSheet(orders);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: "PROSPER Kévin", present: true, derived: false });
  });
});
