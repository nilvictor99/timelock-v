import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "TimeLock-v",
  description: "Control total de tu tiempo"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await cookies()).get("timelock_locale")?.value === "en" ? "en" : "es";
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider initialLocale={locale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
