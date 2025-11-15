import { adminAuth } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { uid, role } = await req.json();
  await adminAuth.setCustomUserClaims(uid, { role });
  return NextResponse.json({ success: true });
}
