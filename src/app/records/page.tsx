"use client";

import Link from "next/link";
import { useI18n } from "@/systems/i18n";
import { loadSave } from "@/systems/save";

export default function RecordsPage() {
  const { t } = useI18n();
  const records = loadSave().records;

  const rows: Array<[string, number]> = [
    ["records.survivalBest", records.survivalBestWave],
    ["records.totalMatches", records.totalMatches],
    ["records.totalPerfects", records.totalPerfects],
    ["records.bestStreak", records.bestPerfectStreak],
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="neon-title font-display text-4xl font-bold tracking-widest">
          {t("records.title")}
        </h1>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>

      <ul className="flex flex-col gap-2">
        {rows.map(([key, value]) => (
          <li
            key={key}
            className="flex items-center justify-between rounded-lg border border-night-700 bg-night-800/60 px-4 py-3"
          >
            <span>{t(key)}</span>
            <span className="font-display text-2xl text-neon-blue">{value}</span>
          </li>
        ))}
      </ul>

      {records.totalMatches === 0 && (
        <p className="text-center text-sm text-night-600">{t("records.empty")}</p>
      )}
    </main>
  );
}
