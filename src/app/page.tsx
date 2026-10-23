"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/systems/i18n";

interface MenuEntry {
  href: string;
  titleKey: string;
  descKey: string;
  accent: string;
  available: boolean;
}

export default function HomePage() {
  const { t } = useI18n();

  const entries: MenuEntry[] = [
    { href: "/campaign", titleKey: "menu.campaign", descKey: "menu.campaignDesc", accent: "#ff3b5c", available: true },
    { href: "/pvp", titleKey: "menu.pvp", descKey: "menu.pvpDesc", accent: "#3fd8ff", available: true },
    { href: "/survival", titleKey: "menu.survival", descKey: "menu.survivalDesc", accent: "#3ddc84", available: true },
    { href: "/coop", titleKey: "menu.coop", descKey: "menu.coopDesc", accent: "#ffd23f", available: true },
    { href: "/online", titleKey: "menu.online", descKey: "menu.onlineDesc", accent: "#a05cff", available: true },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-12">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="neon-title font-display text-6xl font-bold tracking-widest md:text-8xl">
          {t("app.title")}
        </h1>
        <p className="mt-3 text-lg text-night-600">{t("app.tagline")}</p>
      </motion.header>

      <nav className="grid w-full max-w-2xl grid-cols-1 gap-3">
        {entries.map((entry, i) => (
          <motion.div
            key={entry.href}
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
          >
            <Link
              href={entry.href}
              aria-disabled={!entry.available}
              className={`group flex items-center justify-between rounded-xl border border-night-700 bg-night-800/60 px-5 py-4 transition-all ${
                entry.available
                  ? "hover:scale-[1.02] hover:border-opacity-100"
                  : "cursor-not-allowed opacity-40"
              }`}
              style={{ borderColor: entry.available ? entry.accent : undefined }}
            >
              <div>
                <div className="font-display text-xl font-semibold tracking-wide">
                  {t(entry.titleKey)}
                </div>
                <div className="text-sm text-night-600">{t(entry.descKey)}</div>
              </div>
              <span className="font-display text-2xl" style={{ color: entry.accent }}>
                {entry.available ? "▶" : "🔒"}
              </span>
            </Link>
          </motion.div>
        ))}
      </nav>

      <footer className="flex gap-6 text-sm">
        <Link href="/options" className="text-night-600 transition-colors hover:text-white">
          {t("menu.options")}
        </Link>
        <Link href="/codex" className="text-night-600 transition-colors hover:text-white">
          {t("menu.codex")}
        </Link>
        <Link href="/records" className="text-night-600 transition-colors hover:text-white">
          {t("menu.records")}
        </Link>
      </footer>
    </main>
  );
}
