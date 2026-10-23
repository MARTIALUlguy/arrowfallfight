"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHARACTERS } from "@/data/characters";
import { useI18n } from "@/systems/i18n";

const PLAYABLE_COOP_CHARACTERS = CHARACTERS.filter((character) => character.id !== "vorn");

export default function CoopPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [first, setFirst] = useState("kael");
  const [second, setSecond] = useState("lyra");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="neon-title font-display text-3xl font-bold tracking-widest">
          {t("coop.title")}
        </h1>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>
      <p className="text-sm text-night-600">{t("coop.subtitle")}</p>
      {[
        { player: 1, value: first, set: setFirst },
        { player: 2, value: second, set: setSecond },
      ].map((slot) => (
        <label key={slot.player} className="flex flex-col gap-2 rounded-xl border border-night-700 bg-night-800/60 p-4">
          <span className="font-display text-xl">{t("pvp.player", { n: slot.player })}</span>
          <select
            value={slot.value}
            onChange={(event) => slot.set(event.target.value)}
            className="rounded-lg border border-night-600 bg-night-900 px-3 py-2"
          >
            {PLAYABLE_COOP_CHARACTERS.map((character) => (
              <option key={character.id} value={character.id}>{t(character.nameKey)}</option>
            ))}
          </select>
        </label>
      ))}
      {first === second && <p role="alert" className="text-sm text-neon-yellow">{t("coop.sameCharacter")}</p>}
      <p className="rounded-lg border border-neon-yellow/40 bg-neon-yellow/5 p-4 text-sm">
        {t("coop.boss")}
      </p>
      <button
        type="button"
        disabled={first === second}
        onClick={() => router.push(`/game?mode=coop&character=${first}&partner=${second}`)}
        className="rounded-lg bg-neon-yellow px-5 py-3 font-display text-lg font-semibold text-night-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("coop.start")}
      </button>
    </main>
  );
}
