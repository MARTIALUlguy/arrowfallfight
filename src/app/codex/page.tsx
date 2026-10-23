"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CardTile } from "@/components/cards/CardTile";
import { ALL_CARDS, UNIVERSAL_CARDS } from "@/data/cards";
import { CHARACTERS } from "@/data/characters";
import { STATUSES, STATUS_ORDER } from "@/data/statuses";
import { useI18n } from "@/systems/i18n";

export default function CodexPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [cardGroup, setCardGroup] = useState<"all" | "universal" | "signature">("all");
  const universalIds = useMemo(() => new Set(UNIVERSAL_CARDS.map((card) => card.id)), []);
  const filteredCards = ALL_CARDS.filter((card) => {
    const universal = universalIds.has(card.id);
    const matchesGroup = cardGroup === "all"
      || (cardGroup === "universal" && universal)
      || (cardGroup === "signature" && !universal);
    const matchesQuery = `${t(card.nameKey)} ${t(card.descriptionKey)} ${card.id}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
    return matchesGroup && matchesQuery;
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="neon-title font-display text-4xl font-bold tracking-widest">
            {t("codex.title")}
          </h1>
          <p className="mt-1 text-sm text-night-600">{t("codex.subtitle")}</p>
        </div>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">{t("codex.characters")} ({CHARACTERS.length})</h2>
            <p className="text-sm text-night-600">{t("codex.characterDetails")}</p>
          </div>
          <Link href="/select?mode=campaign" className="rounded-md border border-neon-blue/60 px-3 py-2 text-sm text-neon-blue hover:bg-neon-blue/10">
            {t("codex.chooseCharacter")}
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CHARACTERS.map((character) => (
            <article
              key={character.id}
              className="rounded-xl border bg-night-800/60 p-4"
              style={{ borderColor: `${character.accent}88` }}
            >
              <header className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-semibold" style={{ color: character.accent }}>
                    {t(character.nameKey)}
                  </h3>
                  <p className="text-xs text-night-600">{t(character.titleKey)}</p>
                </div>
                <span className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: character.accent, color: character.accent }}>
                  {character.hp} {t("common.hp")}
                </span>
              </header>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="text-night-600">{t("select.archetype")}</dt>
                  <dd>{t(`select.archetypes.${character.archetype}`)}</dd>
                </div>
                <div>
                  <dt className="text-night-600">{t("select.resourceFocus")}</dt>
                  <dd>{t(`select.focus.${character.resourceFocus}`)}</dd>
                </div>
                <div className="col-span-2 rounded-lg bg-night-900/70 p-2">
                  <dt className="font-semibold" style={{ color: character.accent }}>{t(character.mechanicNameKey)}</dt>
                  <dd className="mt-1 text-night-600">{t(character.mechanicDescriptionKey)}</dd>
                </div>
                <div>
                  <dt className="font-semibold">{t("select.abilityAttack")}</dt>
                  <dd className="mt-1">{t(character.abilityAttack.nameKey)}</dd>
                  <dd className="text-night-600">{t(character.abilityAttack.descriptionKey)}</dd>
                  <dd className="text-xs text-neon-blue">{t("codex.actionCost", {
                    cost: character.abilityAttack.cost.energy
                      ? `${t("common.energy")} ${character.abilityAttack.cost.energy}`
                      : `${t("common.mana")} ${character.abilityAttack.cost.mana ?? 0}`,
                    qte: character.abilityAttack.qte,
                  })}</dd>
                </div>
                <div>
                  <dt className="font-semibold">{t("select.abilityDefense")}</dt>
                  <dd className="mt-1">{t(character.abilityDefense.nameKey)}</dd>
                  <dd className="text-night-600">{t(character.abilityDefense.descriptionKey)}</dd>
                  <dd className="text-xs text-neon-blue">{t("codex.actionCost", {
                    cost: character.abilityDefense.cost.energy
                      ? `${t("common.energy")} ${character.abilityDefense.cost.energy}`
                      : `${t("common.mana")} ${character.abilityDefense.cost.mana ?? 0}`,
                    qte: character.abilityDefense.qte,
                  })}</dd>
                </div>
                <div className="col-span-2 border-t border-night-700 pt-2">
                  <dt className="font-semibold text-neon-yellow">{t(character.ultimate.nameKey)} · {t(`codex.ultimateModes.${character.ultimate.mode}`)}</dt>
                  <dd className="mt-1 text-night-600">{t(character.ultimate.descriptionKey)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-night-700 pt-3">
                <span className="text-xs text-night-600">
                  {t("codex.signatureCount", { n: character.signatureCardIds.length })}
                </span>
                <Link
                  href={`/deck?mode=campaign&character=${character.id}`}
                  className="text-xs text-neon-blue hover:underline"
                >
                  {t("codex.openDeck")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">{t("codex.cards")} ({filteredCards.length}/{ALL_CARDS.length})</h2>
            <p className="text-sm text-night-600">{t("codex.cardDetails")}</p>
          </div>
          <label className="text-xs text-night-600">
            {t("codex.searchCards")}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ml-2 rounded-md border border-night-700 bg-night-900 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "universal", "signature"] as const).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setCardGroup(group)}
              aria-pressed={cardGroup === group}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                cardGroup === group
                  ? "border-neon-blue bg-neon-blue/10 text-neon-blue"
                  : "border-night-700 text-night-600 hover:text-white"
              }`}
            >
              {group === "all"
                ? t("deck.filters.all")
                : group === "universal" ? t("codex.universal") : t("codex.signature")}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCards.map((card) => <CardTile key={card.id} card={card} />)}
          {filteredCards.length === 0 && (
            <p className="col-span-full rounded-lg border border-night-700 p-6 text-center text-sm text-night-600">
              {t("deck.noResults")}
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-display text-2xl">{t("codex.statuses")} ({STATUS_ORDER.length})</h2>
          <p className="text-sm text-night-600">{t("codex.statusDetails")}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {STATUS_ORDER.map((id) => {
            const status = STATUSES[id];
            return (
              <li
                key={status.id}
                className="flex gap-3 rounded-xl border bg-night-800/60 p-3"
                style={{ borderColor: `${status.color}88` }}
              >
                <svg viewBox="0 0 24 24" className="mt-0.5 h-7 w-7 shrink-0" aria-hidden="true">
                  <path
                    d={status.icon}
                    fill={status.stroke ? "none" : status.color}
                    stroke={status.stroke ? status.color : "none"}
                    strokeWidth={status.stroke ? 1.7 : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold" style={{ color: status.color }}>{t(status.nameKey)}</h3>
                  <p className="mt-1 text-sm text-night-600">{t(status.descriptionKey)}</p>
                  <span className="mt-2 inline-block rounded-full border border-night-700 px-2 py-0.5 text-[10px] uppercase text-night-600">
                    {status.negative ? t("codex.negative") : t("codex.positive")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
