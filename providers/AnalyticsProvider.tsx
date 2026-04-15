"use client";

import { useEffect } from "react";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { usePathname } from "next/navigation";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Initialize analytics on mount
  useEffect(() => {
    initAnalytics();
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  return <>{children}</>;
}
