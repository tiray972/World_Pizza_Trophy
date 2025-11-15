import { db } from "./firebase/client";
import { doc, runTransaction } from "firebase/firestore";

export async function reserveSlot(slotId: string, userId: string) {
  const slotRef = doc(db, "slots", slotId);

  await runTransaction(db, async (transaction) => {
    const slotDoc = await transaction.get(slotRef);

    if (!slotDoc.exists()) throw new Error("Slot does not exist");
    if (slotDoc.data().userId) throw new Error("Slot already reserved");

    transaction.update(slotRef, { userId, status: "reserved" });
  });

  return { success: true };
}
