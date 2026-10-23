"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHARACTERS } from "@/data/characters";
import { useI18n } from "@/systems/i18n";

export default function LocalPvpPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [first, setFirst] = useState("kael");
  const [second, setSecond] = useState("lyra");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="neon-title font-display text-3xl font-bold tracking-widest">
          {t("pvp.title")}
        </h1>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>
      <p className="text-sm text-night-600">{t("pvp.subtitle")}</p>
      {[{ player: 1, value: first, set: setFirst }, { player: 2, value: second, set: setSecond }].map((slot) => (
        <label key={slot.player} className="flex flex-col gap-2 rounded-xl border border-night-700 bg-night-800/60 p-4">
          <span className="font-display text-xl">{t("pvp.player", { n: slot.player })}</span>
          <select
            value={slot.value}
            onChange={(event) => slot.set(event.target.value)}
            className="rounded-lg border border-night-600 bg-night-900 px-3 py-2"
          >
            {CHARACTERS.map((character) => (
              <option key={character.id} value={character.id}>{t(character.nameKey)}</option>
            ))}
          </select>
        </label>
      ))}
      {first === second && <p className="text-sm text-neon-yellow">{t("pvp.sameCharacter")}</p>}
      <button
        type="button"
        onClick={() => router.push(`/game?mode=local-pvp&character=${first}&opponent=${second}`)}
        className="rounded-lg bg-neon-blue px-5 py-3 font-display text-lg font-semibold text-night-950"
      >
        {t("pvp.start")}
      </button>
    </main>
  );
}
