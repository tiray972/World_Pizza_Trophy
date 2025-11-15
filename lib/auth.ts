import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";

export function watchUser(cb: any) {
  return onAuthStateChanged(auth, (user) => cb(user));
}
