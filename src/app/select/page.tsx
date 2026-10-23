"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/systems/i18n";
import { CHARACTERS } from "@/data/characters";

/** Sélection de personnage — Phase 0 : carrousel basique fonctionnel. */
function SelectContent() {
  const { t } = useI18n();
  const params = useSearchParams();
  const mode = params.get("mode") ?? "campaign";
  const chapter = params.get("chapter");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="neon-title font-display text-4xl font-bold tracking-widest">
          {t("select.title")}
        </h1>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {CHARACTERS.map((c) => (
          <Link
            key={c.id}
            href={`/deck?mode=${mode}&character=${c.id}${chapter ? `&chapter=${chapter}` : ""}`}
            className="group rounded-xl border bg-night-800/60 p-4 transition-transform hover:scale-[1.03]"
            style={{ borderColor: c.accent }}
          >
            <div
              className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full font-display text-4xl font-bold"
              style={{
                background: `radial-gradient(circle, ${c.accent}33, transparent 70%)`,
                color: c.accent,
                border: `2px solid ${c.accent}`,
              }}
            >
              {t(c.nameKey).charAt(0)}
            </div>
            <div className="text-center font-display text-xl" style={{ color: c.accent }}>
              {t(c.nameKey)}
            </div>
            <div className="text-center text-xs text-night-600">{t(c.titleKey)}</div>
            <div className="mt-2 text-center text-xs text-night-600">
              {t("common.hp")} {c.hp} · {t(`select.archetypes.${c.archetype}`)}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

export default function SelectPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">ARROWFALL</main>}>
      <SelectContent />
    </Suspense>
  );
}
