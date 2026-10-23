import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import { I18nProvider } from "@/systems/i18n";
import "./globals.css";

const display = Oswald({ subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "ARROWFALL",
  description:
    "Jeu de combat tour par tour stratégique avec QTE — strategy, reflexes, neon.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${body.variable} font-body`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
