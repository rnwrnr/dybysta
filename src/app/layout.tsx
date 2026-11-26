import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/provider";
import { getServerLang, getServerT } from "@/lib/i18n/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: { default: t("DYBYSTA — your proactive personal assistant"), template: "%s · DYBYSTA" },
    description: t("Capture tasks, reminders, ideas and notes by typing or speaking naturally. AI organizes — you stay the boss."),
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#fbf8f3" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getServerLang();
  return (
    <html lang={lang}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <I18nProvider initialLang={lang}>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
