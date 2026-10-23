"use client";

import { getCharacter } from "@/data/characters";
import type { CardDef } from "@/types";
import { useI18n } from "@/systems/i18n";

interface CardTileProps {
  card: CardDef;
  count?: number;
  onAdd?: () => void;
  onRemove?: () => void;
  addDisabled?: boolean;
  compact?: boolean;
}

const RARITY_COLORS = {
  common: "#9aa3b5",
  rare: "#3fd8ff",
  epic: "#ffd23f",
} as const;

export function CardTile({
  card,
  count,
  onAdd,
  onRemove,
  addDisabled = false,
  compact = false,
}: CardTileProps) {
  const { t } = useI18n();
  const character = card.characterId ? getCharacter(card.characterId) : null;
  const color = character?.accent ?? RARITY_COLORS[card.rarity];
  const maxCopies = card.rarity === "epic" ? 1 : 2;
  const isInDeck = count !== undefined;

  return (
    <article
      className={`flex shrink-0 flex-col rounded-xl border bg-night-800/80 p-3 shadow-lg shadow-black/20 transition-colors ${
        compact ? "min-h-20" : "min-h-44"
      }`}
      style={{ borderColor: `${color}88`, boxShadow: `inset 0 2px 0 ${color}25` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {t(`deck.rarities.${card.rarity}`)}
        </span>
        <div className="flex flex-wrap justify-end gap-1">
          {card.cost.energy ? (
            <span className="rounded-full border border-neon-red/50 px-2 text-xs text-neon-red">
              E {card.cost.energy}
            </span>
          ) : null}
          {card.cost.mana ? (
            <span className="rounded-full border border-neon-blue/50 px-2 text-xs text-neon-blue">
              M {card.cost.mana}
            </span>
          ) : null}
          {card.cost.hp ? (
            <span className="rounded-full border border-neon-red/50 px-2 text-xs text-neon-red">
              PV {card.cost.hp}
            </span>
          ) : null}
          {!Object.keys(card.cost).length && (
            <span className="rounded-full border border-night-600 px-2 text-xs text-night-600">0</span>
          )}
        </div>
      </div>

      <h3 className="font-display text-base font-semibold leading-tight" style={{ color }}>
        {t(card.nameKey)}
      </h3>
      {!compact && <p className="mt-1 text-xs text-night-600">{t(`deck.types.${card.type}`)}</p>}
      {!compact && (
        <p className="mt-2 flex-1 text-sm leading-relaxed text-white/80">
          {t(card.descriptionKey)}
        </p>
      )}

      <div className={`${compact ? "mt-2" : "mt-3 border-t border-night-700 pt-2"} flex items-center justify-between gap-2`}>
        {!compact && (
          <span className="text-xs text-night-600">
            {card.qte > 0 ? `QTE ${card.qte}` : t("deck.instant")}
            {card.statusOnPerfectOnly && (
              <span className="ml-2 text-neon-yellow" title={t("deck.perfectBadge")}>✦</span>
            )}
          </span>
        )}
        {isInDeck && (
          <span className="text-xs text-night-600">
            {t("deck.copies", { n: count, max: maxCopies })}
          </span>
        )}
      </div>
      {(onAdd || onRemove) && (
        <div className="mt-2 flex gap-2">
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              disabled={addDisabled}
              aria-label={`${t("deck.add")} ${t(card.nameKey)}`}
              className="flex-1 rounded-md border border-neon-green/50 py-1 text-sm text-neon-green transition hover:bg-neon-green/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              + {t("deck.add")}
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${t("deck.remove")} ${t(card.nameKey)}`}
              className="flex-1 rounded-md border border-neon-red/50 py-1 text-sm text-neon-red transition hover:bg-neon-red/10"
            >
              − {t("deck.remove")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
