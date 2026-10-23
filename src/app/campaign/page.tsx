"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/systems/i18n";
import { CAMPAIGN_CHAPTERS } from "@/data/campaign";
import { getCharacter } from "@/data/characters";
import { defaultSave, loadSave } from "@/systems/save";

export default function CampaignPage() {
  const { t } = useI18n();
  const [save, setSave] = useState(defaultSave);
  useEffect(() => setSave(loadSave()), []);
  const unlockedChapter = Math.min(
    CAMPAIGN_CHAPTERS.length,
    Math.max(1, save.campaign.completedChapters.length + 1),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 md:px-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="neon-title font-display text-4xl font-bold tracking-widest">
            {t("campaign.title")}
          </h1>
          <p className="mt-2 text-sm text-night-600">{t("campaign.subtitle")}</p>
        </div>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>

      <ol className="flex flex-col gap-3">
        {CAMPAIGN_CHAPTERS.map((chapter) => {
          const completed = save.campaign.completedChapters.includes(chapter.id);
          const unlocked = completed || chapter.id <= unlockedChapter;
          const opponent = getCharacter(chapter.opponentId);
          const intro = chapter.introKeys.map((key) => t(key)).join(" ");

          return (
            <li key={chapter.id}>
              <Link
                href={unlocked ? `/select?mode=campaign&chapter=${chapter.id}` : "#"}
                aria-disabled={!unlocked}
                onClick={(event) => {
                  if (!unlocked) event.preventDefault();
                }}
                className={`grid gap-3 rounded-xl border bg-night-800/60 p-4 sm:grid-cols-[4rem_1fr_auto] sm:items-center ${
                  unlocked ? "hover:border-neon-blue" : "cursor-not-allowed opacity-45"
                }`}
                style={{ borderColor: unlocked ? opponent.accent : undefined }}
              >
                <span className="font-display text-3xl font-bold text-neon-blue">
                  {String(chapter.id).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-display text-xl font-semibold" style={{ color: opponent.accent }}>
                    {t(opponent.nameKey)} · {t(`campaign.difficulties.${chapter.difficulty}`)}
                  </span>
                  <span className="mt-1 block text-sm text-night-600">{intro}</span>
                </span>
                <span className={`text-sm font-semibold ${completed ? "text-neon-green" : "text-neon-blue"}`}>
                  {completed ? t("campaign.completed") : unlocked ? t("campaign.play") : t("campaign.locked")}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
