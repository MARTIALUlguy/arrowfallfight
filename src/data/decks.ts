// ============================================================================
// ARROWFALL — Règles de construction de deck + deck universel de base
// ============================================================================

import type { CardDef, Rarity } from "@/types";
import { getCard } from "./cards";
import { getCharacter } from "./characters";

export const DECK_SIZE = 20;
export const MAX_COPIES: Record<Rarity, number> = {
  common: 2,
  rare: 2,
  epic: 1,
};

/**
 * Deck universel de base (20 cartes), proposé par défaut à tout joueur.
 * Équilibré : 7 attaques, 7 défenses, 6 utilitaires/buffs.
 */
export const BASE_UNIVERSAL_DECK: string[] = [
  "frappe-eclair", "frappe-eclair",
  "frappe-lourde",
  "percee-berserk",
  "boule-feu", "boule-feu",
  "trait-givre", "trait-givre",
  "poison-insidieux",
  "chaine-eclairs",
  "parade-acier", "parade-acier",
  "bloc-titan",
  "garde-fer", "garde-fer",
  "mur-mana",
  "carapace-givre",
  "second-souffle",
  "concentration",
  "coup-critique",
];

export type DeckValidation =
  | { ok: true }
  | { ok: false; reason: "size" | "copies" | "unknown" | "character"; detail?: string };

/** Valide un deck selon les règles : 20 cartes, max 2 copies (1 épique), ids connus. */
export function validateDeck(cardIds: string[]): DeckValidation {
  if (cardIds.length !== DECK_SIZE) return { ok: false, reason: "size" };
  const counts = new Map<string, number>();
  let epicCount = 0;
  for (const id of cardIds) {
    let card: CardDef;
    try {
      card = getCard(id);
    } catch {
      return { ok: false, reason: "unknown", detail: id };
    }
    const next = (counts.get(id) ?? 0) + 1;
    if (next > MAX_COPIES[card.rarity]) {
      return { ok: false, reason: "copies", detail: id };
    }
    if (card.rarity === "epic" && ++epicCount > 1) {
      return { ok: false, reason: "copies", detail: id };
    }
    counts.set(id, next);
  }
  return { ok: true };
}

export function validateCharacterDeck(
  characterId: string,
  cardIds: string[],
): DeckValidation {
  const validation = validateDeck(cardIds);
  if (!validation.ok) return validation;
  const character = getCharacter(characterId);
  const signatureIds = new Set(character.signatureCardIds);
  for (const id of cardIds) {
    const card = getCard(id);
    if (card.characterId && !signatureIds.has(id)) {
      return { ok: false, reason: "character", detail: id };
    }
  }
  return { ok: true };
}

/** Compte les occurrences de chaque coût (ressource ou PV) pour la courbe du deck-builder. */
export function costCurve(cardIds: string[]): Record<number, number> {
  const curve: Record<number, number> = {};
  for (const id of cardIds) {
    const card = getCard(id);
    const cost = (card.cost.energy ?? 0) + (card.cost.mana ?? 0) + (card.cost.hp ?? 0);
    curve[cost] = (curve[cost] ?? 0) + 1;
  }
  return curve;
}
