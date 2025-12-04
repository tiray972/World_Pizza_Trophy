// app/[lang]/auth/register/page.tsx
"use client";

import { Suspense } from "react";
import RegisterForm from "@/app/[lang]/auth/register/RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
