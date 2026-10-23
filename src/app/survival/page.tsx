"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/systems/i18n";
import { defaultSave, loadSave, updateSave } from "@/systems/save";
import { CHARACTERS_BY_ID, getCharacter } from "@/data/characters";

export default function SurvivalPage() {
  const { t } = useI18n();
  const [save, setSave] = useState(defaultSave);
  useEffect(() => setSave(loadSave()), []);
  const run = save.survivalRun;
  const canResume = run !== null && run.hp > 0 && CHARACTERS_BY_ID.has(run.characterId);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="neon-title font-display text-4xl font-bold tracking-widest">
          {t("survival.title")}
        </h1>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>
      <p className="text-night-600">{t("survival.subtitle")}</p>
      {canResume && run && (
        <section className="rounded-xl border border-neon-green/60 bg-night-800/60 p-5">
          <h2 className="font-display text-xl font-semibold text-neon-green">
            {t("survival.resumeTitle", { n: run.wave })}
          </h2>
          <p className="mt-2 text-sm text-night-600">
            {t(getCharacter(run.characterId).nameKey)} · {run.hp}/{run.maxHp} {t("common.hp")}
          </p>
          <Link
            href={`/game?mode=survival&character=${run.characterId}&wave=${run.wave}`}
            className="mt-4 inline-block rounded-lg bg-neon-green px-4 py-2 font-semibold text-night-950"
          >
            {t("survival.resume")}
          </Link>
        </section>
      )}
      <Link
        href="/select?mode=survival"
        onClick={() => {
          if (run) {
            updateSave({ survivalRun: null });
            setSave((current) => ({ ...current, survivalRun: null }));
          }
        }}
        className="rounded-lg border border-night-600 px-4 py-3 text-center font-semibold hover:border-neon-blue"
      >
        {t("survival.newRun")}
      </Link>
    </main>
  );
}
