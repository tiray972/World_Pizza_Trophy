import { defaultLocale } from "@/lib/i18n/config";

export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return <html lang={defaultLocale}><body>{children}</body></html>;
}
