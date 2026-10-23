"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CardTile } from "@/components/cards/CardTile";
import { ALL_CARDS } from "@/data/cards";
import { CHARACTERS_BY_ID, getCharacter } from "@/data/characters";
import { costCurve, DECK_SIZE, MAX_COPIES, validateCharacterDeck } from "@/data/decks";
import { getCustomDeck, setCustomDeck } from "@/systems/save";
import { useI18n } from "@/systems/i18n";
import type { CardType, Rarity } from "@/types";

const CARD_TYPES: CardType[] = ["attack-melee", "attack-ranged", "defense", "utility", "buff"];
const RARITIES: Rarity[] = ["common", "rare", "epic"];

function DeckContent() {
  const { t } = useI18n();
  const params = useSearchParams();
  const mode = params.get("mode") ?? "campaign";
  const chapter = params.get("chapter");
  const requestedCharacter = params.get("character") ?? "kael";
  const characterId = CHARACTERS_BY_ID.has(requestedCharacter) ? requestedCharacter : "kael";
  const character = getCharacter(characterId);
  const [deck, setDeck] = useState<string[]>(() => {
    const custom = getCustomDeck(characterId);
    return custom && validateCharacterDeck(characterId, custom).ok
      ? custom
      : [...character.recommendedDeck];
  });
  const [filterType, setFilterType] = useState<CardType | "all">("all");
  const [filterRarity, setFilterRarity] = useState<Rarity | "all">("all");
  const [filterCost, setFilterCost] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const cardPool = useMemo(() => {
    const signatures = new Set(character.signatureCardIds);
    return ALL_CARDS.filter((card) => !card.characterId || signatures.has(card.id));
  }, [character.signatureCardIds]);
  const filteredCards = cardPool.filter((card) => {
    const text = `${t(card.nameKey)} ${t(card.descriptionKey)} ${card.id}`.toLocaleLowerCase();
    return (filterType === "all" || card.type === filterType)
      && (filterRarity === "all" || card.rarity === filterRarity)
      && (filterCost === "all" || (card.cost.energy ?? 0) + (card.cost.mana ?? 0) + (card.cost.hp ?? 0) === filterCost)
      && text.includes(search.trim().toLocaleLowerCase());
  });
  const validation = validateCharacterDeck(characterId, deck);
  const counts = useMemo(() => deck.reduce<Record<string, number>>((all, id) => {
    all[id] = (all[id] ?? 0) + 1;
    return all;
  }, {}), [deck]);
  const curve = costCurve(deck);
  const maxCurve = Math.max(1, ...Object.values(curve));

  const validationMessage = validation.ok
    ? t("deck.valid")
    : validation.reason === "size"
      ? t("deck.errors.size")
      : validation.reason === "copies"
        ? t("deck.errors.copies")
        : validation.reason === "character"
          ? t("deck.errors.character")
          : t("deck.errors.unknown");

  const addCard = (id: string) => {
    const card = cardPool.find((entry) => entry.id === id);
    if (!card || deck.length >= DECK_SIZE) return;
    const copies = counts[id] ?? 0;
    if (copies >= MAX_COPIES[card.rarity]) return;
    if (card.rarity === "epic" && !copies && deck.some((deckId) =>
      cardPool.find((entry) => entry.id === deckId)?.rarity === "epic",
    )) return;
    setDeck((current) => [...current, id]);
  };

  const removeCard = (id: string) => {
    setDeck((current) => {
      const index = current.lastIndexOf(id);
      return index < 0 ? current : current.filter((_, cardIndex) => cardIndex !== index);
    });
  };

  const saveAndStart = () => {
    if (!validation.ok) return;
    setCustomDeck(characterId, deck);
  };

  const resetDeck = () => {
    setDeck([...character.recommendedDeck]);
    setCustomDeck(characterId, character.recommendedDeck);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="neon-title font-display text-4xl font-bold tracking-widest">
          {t("deck.title")}
        </h1>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>

      <p className="text-night-600">
        {t("select.title")} :{" "}
        <span className="font-semibold" style={{ color: character.accent }}>{t(character.nameKey)}</span>
        {" "}· {mode}
      </p>

      <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm ${
            validation.ok
              ? "border-neon-green/60 text-neon-green"
              : "border-neon-red/60 text-neon-red"
          }`}
          aria-live="polite"
        >
          <span>{validationMessage}</span>
          <span className="font-semibold">{t("deck.count", { n: deck.length })}</span>
        </div>
        <div className="rounded-lg border border-night-700 bg-night-800/60 px-4 py-3">
          <h2 className="mb-2 text-sm font-semibold">{t("deck.costCurve")}</h2>
          <div className="flex h-12 items-end gap-2" aria-label={t("deck.costCurve")}>
            {Array.from({ length: 11 }, (_, cost) => (
              <div key={cost} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full min-h-0 rounded-t bg-neon-blue/80 transition-[height]"
                  style={{ height: `${((curve[cost] ?? 0) / maxCurve) * 32}px` }}
                  title={`${cost}: ${curve[cost] ?? 0}`}
                />
                <span className="text-[10px] text-night-600">{cost}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(350px,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{t("deck.library")} ({cardPool.length})</h2>
            <button
              type="button"
              onClick={resetDeck}
              className="rounded-md border border-night-600 px-3 py-1.5 text-sm hover:border-neon-blue"
            >
              {t("deck.recommended")}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-night-600">
              {t("deck.search")}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-1 w-full rounded-md border border-night-700 bg-night-900 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-night-600">
              {t("deck.filters.type")}
              <select
                value={filterType}
                onChange={(event) => setFilterType(event.target.value as CardType | "all")}
                className="mt-1 w-full rounded-md border border-night-700 bg-night-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">{t("deck.filters.all")}</option>
                {CARD_TYPES.map((type) => <option key={type} value={type}>{t(`deck.types.${type}`)}</option>)}
              </select>
            </label>
            <label className="text-xs text-night-600">
              {t("deck.filters.rarity")}
              <select
                value={filterRarity}
                onChange={(event) => setFilterRarity(event.target.value as Rarity | "all")}
                className="mt-1 w-full rounded-md border border-night-700 bg-night-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">{t("deck.filters.all")}</option>
                {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{t(`deck.rarities.${rarity}`)}</option>)}
              </select>
            </label>
            <label className="text-xs text-night-600">
              {t("deck.filters.cost")}
              <select
                value={filterCost}
                onChange={(event) => setFilterCost(event.target.value === "all" ? "all" : Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-night-700 bg-night-900 px-3 py-2 text-sm text-white"
              >
                <option value="all">{t("deck.filters.all")}</option>
                {Array.from({ length: 11 }, (_, cost) => (
                  <option key={cost} value={cost}>{cost}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid max-h-[68vh] auto-rows-max gap-3 overflow-y-auto p-1 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => {
              const copies = counts[card.id] ?? 0;
              const hasEpic = card.rarity === "epic" && copies === 0
                && deck.some((id) => cardPool.find((candidate) => candidate.id === id)?.rarity === "epic");
              return (
                <CardTile
                  key={card.id}
                  card={card}
                  count={copies}
                  onAdd={() => addCard(card.id)}
                  onRemove={copies > 0 ? () => removeCard(card.id) : undefined}
                  addDisabled={deck.length >= DECK_SIZE || copies >= MAX_COPIES[card.rarity] || hasEpic}
                />
              );
            })}
            {filteredCards.length === 0 && (
              <p className="col-span-full rounded-lg border border-night-700 p-6 text-center text-sm text-night-600">
                {t("deck.noResults")}
              </p>
            )}
          </div>
        </div>

        <aside className="flex min-h-64 flex-col gap-3">
          <h2 className="font-display text-2xl">{t("deck.current")}</h2>
          <div className="flex max-h-[68vh] flex-col gap-2 overflow-y-auto pr-1">
            {deck.map((id, index) => {
              const card = cardPool.find((entry) => entry.id === id);
              if (!card) return null;
              return (
                <CardTile
                  key={`${id}-${index}`}
                  card={card}
                  compact
                  count={counts[id]}
                  onRemove={() => removeCard(id)}
                />
              );
            })}
            {deck.length === 0 && (
              <p className="rounded-lg border border-dashed border-night-600 p-6 text-center text-sm text-night-600">
                {t("deck.empty")}
              </p>
            )}
          </div>
          <Link
            href={validation.ok
              ? `/game?mode=${encodeURIComponent(mode)}&character=${encodeURIComponent(characterId)}${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ""}`
              : "#"}
            onClick={(event) => {
              if (!validation.ok) {
                event.preventDefault();
                return;
              }
              saveAndStart();
            }}
            aria-disabled={!validation.ok}
            className={`mt-auto rounded-lg px-5 py-3 text-center font-display text-lg font-semibold transition ${
              validation.ok
                ? "bg-neon-blue text-night-950 hover:scale-[1.02]"
                : "cursor-not-allowed bg-night-700 text-night-600"
            }`}
          >
            {validation.ok ? t("deck.saveAndPlay") : t("deck.completeToPlay")}
          </Link>
        </aside>
      </section>
    </main>
  );
}

export default function DeckPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">ARROWFALL</main>}>
      <DeckContent />
    </Suspense>
  );
}
