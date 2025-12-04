// app/[lang]/auth/login/page.tsx
"use client";

import { Suspense } from "react";
import LoginForm from "@/app/[lang]/auth/login/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
