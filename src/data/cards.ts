// ============================================================================
// ARROWFALL — Cartes : 26 universelles + 24 signatures (3 par personnage)
// Toutes les valeurs numériques vivent ici ; l'équilibrage ne touche que ce fichier.
// ============================================================================

import type { CardDef } from "@/types";

export const UNIVERSAL_CARDS: CardDef[] = [
  // ---------------------------------------------------------------- mêlée ---
  {
    id: "frappe-eclair", type: "attack-melee", rarity: "common",
    cost: { energy: 2 }, qte: 4,
    nameKey: "card.frappe-eclair.name", descriptionKey: "card.frappe-eclair.description",
    effect: { damage: 12 },
  },
  {
    id: "frappe-lourde", type: "attack-melee", rarity: "common",
    cost: { energy: 4 }, qte: 5,
    nameKey: "card.frappe-lourde.name", descriptionKey: "card.frappe-lourde.description",
    effect: { damage: 22 },
  },
  {
    id: "percee-berserk", type: "attack-melee", rarity: "rare",
    cost: { energy: 3 }, qte: 4,
    nameKey: "card.percee-berserk.name", descriptionKey: "card.percee-berserk.description",
    effect: { damage: 10, bonusIfSelfLowHp: 10 },
  },
  {
    id: "coup-bas", type: "attack-melee", rarity: "epic",
    cost: { energy: 3 }, qte: 5, statusOnPerfectOnly: true,
    nameKey: "card.coup-bas.name", descriptionKey: "card.coup-bas.description",
    effect: {
      damage: 6,
      targetStatuses: [{ id: "stun", duration: 1, onPerfect: true }],
    },
  },
  {
    id: "vengeance", type: "attack-melee", rarity: "epic",
    cost: { energy: 3 }, qte: 4,
    nameKey: "card.vengeance.name", descriptionKey: "card.vengeance.description",
    effect: { damage: 8, bonusPerRecentDamageTaken: 1 },
  },
  {
    id: "marteau-sismique", type: "attack-melee", rarity: "rare",
    cost: { energy: 5 }, qte: 5,
    nameKey: "card.marteau-sismique.name", descriptionKey: "card.marteau-sismique.description",
    effect: { damage: 18, removeEnemyEnergy: 2 },
  },
  // ------------------------------------------------------------ distance ----
  {
    id: "boule-feu", type: "attack-ranged", rarity: "common",
    cost: { mana: 3 }, qte: 4,
    nameKey: "card.boule-feu.name", descriptionKey: "card.boule-feu.description",
    effect: { damage: 14, targetStatuses: [{ id: "burn", duration: 3 }] },
  },
  {
    id: "chaine-eclairs", type: "attack-ranged", rarity: "rare",
    cost: { mana: 4 }, qte: 4,
    nameKey: "card.chaine-eclairs.name", descriptionKey: "card.chaine-eclairs.description",
    effect: { damage: 10, ignoreShield: true },
  },
  {
    id: "fleche-perce-armure", type: "attack-ranged", rarity: "rare",
    cost: { mana: 3 }, qte: 5,
    nameKey: "card.fleche-perce-armure.name", descriptionKey: "card.fleche-perce-armure.description",
    effect: { damage: 12, ignoreDefenseExceptPerfectGuard: true },
  },
  {
    id: "trait-givre", type: "attack-ranged", rarity: "common",
    cost: { mana: 2 }, qte: 3,
    nameKey: "card.trait-givre.name", descriptionKey: "card.trait-givre.description",
    effect: { damage: 8, targetStatuses: [{ id: "chill", duration: 1 }] },
  },
  {
    id: "poison-insidieux", type: "attack-ranged", rarity: "common",
    cost: { mana: 2 }, qte: 3,
    nameKey: "card.poison-insidieux.name", descriptionKey: "card.poison-insidieux.description",
    effect: {
      damage: 4,
      targetStatuses: [{ id: "poison", amount: 2, stackable: true }],
    },
  },
  // ------------------------------------------------------------- défense ----
  {
    id: "parade-acier", type: "defense", rarity: "common",
    cost: { energy: 2 }, qte: 4,
    nameKey: "card.parade-acier.name", descriptionKey: "card.parade-acier.description",
    effect: { block: 60 },
  },
  {
    id: "bloc-titan", type: "defense", rarity: "common",
    cost: { energy: 4 }, qte: 5,
    nameKey: "card.bloc-titan.name", descriptionKey: "card.bloc-titan.description",
    effect: { block: 80, shield: 5 },
  },
  {
    id: "garde-fer", type: "defense", rarity: "common",
    cost: { energy: 2 }, qte: 4,
    nameKey: "card.garde-fer.name", descriptionKey: "card.garde-fer.description",
    effect: { block: 40, counterDamage: 6, counterIfMelee: true },
  },
  {
    id: "danse-ombre", type: "defense", rarity: "rare",
    cost: { energy: 3 }, qte: 5, statusOnPerfectOnly: true,
    nameKey: "card.danse-ombre.name", descriptionKey: "card.danse-ombre.description",
    effect: { block: 30, negateOnPerfect: true },
  },
  {
    id: "mur-mana", type: "defense", rarity: "common",
    cost: { mana: 3 }, qte: 4,
    nameKey: "card.mur-mana.name", descriptionKey: "card.mur-mana.description",
    effect: { block: 60, manaGain: 2 },
  },
  {
    id: "carapace-givre", type: "defense", rarity: "common",
    cost: { mana: 2 }, qte: 4,
    nameKey: "card.carapace-givre.name", descriptionKey: "card.carapace-givre.description",
    effect: { block: 50, targetStatuses: [{ id: "chill", duration: 1 }] },
  },
  {
    id: "prisme-reflechissant", type: "defense", rarity: "epic",
    cost: { mana: 4 }, qte: 5,
    nameKey: "card.prisme-reflechissant.name", descriptionKey: "card.prisme-reflechissant.description",
    effect: { block: 50, reflectBlockedPercent: 30 },
  },
  // ---------------------------------------------------------- utilitaires ---
  {
    id: "second-souffle", type: "utility", rarity: "common",
    cost: { mana: 3 }, qte: 0,
    nameKey: "card.second-souffle.name", descriptionKey: "card.second-souffle.description",
    effect: { heal: 12 },
  },
  {
    id: "concentration", type: "utility", rarity: "common",
    cost: { mana: 1 }, qte: 0,
    nameKey: "card.concentration.name", descriptionKey: "card.concentration.description",
    effect: { drawCards: 2 },
  },
  {
    id: "coup-critique", type: "buff", rarity: "rare",
    cost: { energy: 2 }, qte: 0,
    nameKey: "card.coup-critique.name", descriptionKey: "card.coup-critique.description",
    effect: { nextAttackBonusPercent: 50 },
  },
  {
    id: "adrenaline", type: "buff", rarity: "rare",
    cost: { energy: 2 }, qte: 0,
    nameKey: "card.adrenaline.name", descriptionKey: "card.adrenaline.description",
    effect: { superGain: 25 },
  },
  {
    id: "vol-ether", type: "utility", rarity: "epic",
    cost: { mana: 3 }, qte: 0,
    nameKey: "card.vol-ether.name", descriptionKey: "card.vol-ether.description",
    effect: { stealEnergy: 2, stealMana: 2 },
  },
  {
    id: "premeditation", type: "utility", rarity: "rare",
    cost: { mana: 2 }, qte: 0,
    nameKey: "card.premeditation.name", descriptionKey: "card.premeditation.description",
    effect: { revealNextAction: true },
  },
  {
    id: "echange-sanglant", type: "utility", rarity: "rare",
    cost: { hp: 8 }, qte: 0,
    nameKey: "card.echange-sanglant.name", descriptionKey: "card.echange-sanglant.description",
    effect: { energyGain: 4, manaGain: 4 },
  },
  {
    id: "purge", type: "utility", rarity: "common",
    cost: { mana: 2 }, qte: 0,
    nameKey: "card.purge.name", descriptionKey: "card.purge.description",
    effect: { cleanseNegative: true },
  },
];

export const SIGNATURE_CARDS: CardDef[] = [
  // ----------------------------------------------------------------- KAËL ---
  {
    id: "kael-entaille", type: "attack-melee", rarity: "rare", characterId: "kael",
    cost: { energy: 2 }, qte: 4,
    nameKey: "card.kael-entaille.name", descriptionKey: "card.kael-entaille.description",
    effect: {
      damage: 8,
      bonusPerTargetStack: { status: "bleed", per: 2 },
      targetStatuses: [{ id: "bleed", duration: 3, stackable: true }],
    },
  },
  {
    id: "kael-iaido", type: "defense", rarity: "epic", characterId: "kael",
    cost: { energy: 1 }, qte: 5, statusOnPerfectOnly: true,
    nameKey: "card.kael-iaido.name", descriptionKey: "card.kael-iaido.description",
    effect: { block: 40, negateMeleeOnPerfect: true },
  },
  {
    id: "kael-eveil", type: "buff", rarity: "rare", characterId: "kael",
    cost: { energy: 2 }, qte: 0,
    nameKey: "card.kael-eveil.name", descriptionKey: "card.kael-eveil.description",
    effect: { superGain: 30 },
  },
  // ----------------------------------------------------------------- LYRA ---
  {
    id: "lyra-souffle", type: "attack-ranged", rarity: "rare", characterId: "lyra",
    cost: { mana: 1 }, qte: 0,
    nameKey: "card.lyra-souffle.name", descriptionKey: "card.lyra-souffle.description",
    effect: { damage: 0, consumeBurnAsDamage: true },
  },
  {
    id: "lyra-volatile", type: "attack-ranged", rarity: "rare", characterId: "lyra",
    cost: { mana: 3 }, qte: 4,
    nameKey: "card.lyra-volatile.name", descriptionKey: "card.lyra-volatile.description",
    effect: { damage: 12, bonusIfTargetBurning: 8 },
  },
  {
    id: "lyra-surchauffe", type: "buff", rarity: "rare", characterId: "lyra",
    cost: { mana: 1 }, qte: 0,
    nameKey: "card.lyra-surchauffe.name", descriptionKey: "card.lyra-surchauffe.description",
    effect: { superGain: 25, nextRangedCardCostMinus: 1 },
  },
  // ----------------------------------------------------------------- VÖRN ---
  {
    id: "vorn-provocation", type: "defense", rarity: "common", characterId: "vorn",
    cost: { energy: 2 }, qte: 4,
    nameKey: "card.vorn-provocation.name", descriptionKey: "card.vorn-provocation.description",
    effect: { block: 50, enemyNextAttackCostPlus: 1 },
  },
  {
    id: "vorn-ecrasement", type: "attack-melee", rarity: "rare", characterId: "vorn",
    cost: { energy: 5 }, qte: 5,
    nameKey: "card.vorn-ecrasement.name", descriptionKey: "card.vorn-ecrasement.description",
    effect: { damage: 20, damageEnemyShieldPercent: 50 },
  },
  {
    id: "vorn-coeur", type: "buff", rarity: "common", characterId: "vorn",
    cost: { energy: 2 }, qte: 0,
    nameKey: "card.vorn-coeur.name", descriptionKey: "card.vorn-coeur.description",
    effect: { shield: 10 },
  },
  // --------------------------------------------------------------- SYLPHE ---
  {
    id: "sylphe-botte", type: "attack-melee", rarity: "rare", characterId: "sylphe",
    cost: { energy: 1 }, qte: 4, statusOnPerfectOnly: true,
    nameKey: "card.sylphe-botte.name", descriptionKey: "card.sylphe-botte.description",
    effect: { damage: 6, stealEnergyOnPerfect: 2 },
  },
  {
    id: "sylphe-brise", type: "defense", rarity: "rare", characterId: "sylphe",
    cost: { mana: 2 }, qte: 4,
    nameKey: "card.sylphe-brise.name", descriptionKey: "card.sylphe-brise.description",
    effect: { block: 45, manaGain: 2 },
  },
  {
    id: "sylphe-pas", type: "buff", rarity: "epic", characterId: "sylphe",
    cost: { energy: 1 }, qte: 0,
    nameKey: "card.sylphe-pas.name", descriptionKey: "card.sylphe-pas.description",
    effect: { superGain: 30, varsSet: { nextQtePerfectOnly: 1 } },
  },
  // -------------------------------------------------------------- MORDRAK ---
  {
    id: "mordrak-siphon", type: "attack-ranged", rarity: "rare", characterId: "mordrak",
    cost: { mana: 2 }, qte: 3,
    nameKey: "card.mordrak-siphon.name", descriptionKey: "card.mordrak-siphon.description",
    effect: {
      damage: 4,
      targetStatuses: [{ id: "poison", amount: 2, stackable: true }],
      heal: 4,
    },
  },
  {
    id: "mordrak-pacte", type: "utility", rarity: "rare", characterId: "mordrak",
    cost: { hp: 10 }, qte: 0,
    nameKey: "card.mordrak-pacte.name", descriptionKey: "card.mordrak-pacte.description",
    effect: { manaGain: 5 },
  },
  {
    id: "mordrak-ossements", type: "defense", rarity: "common", characterId: "mordrak",
    cost: { mana: 2 }, qte: 4,
    nameKey: "card.mordrak-ossements.name", descriptionKey: "card.mordrak-ossements.description",
    effect: {
      block: 45,
      counterStatuses: [{ id: "poison", amount: 1, stackable: true }],
    },
  },
  // ----------------------------------------------------------------- AÏKO ---
  {
    id: "aiko-enchainement", type: "attack-melee", rarity: "rare", characterId: "aiko",
    cost: { energy: 3 }, qte: 4,
    nameKey: "card.aiko-enchainement.name", descriptionKey: "card.aiko-enchainement.description",
    effect: { hits: 2, damage: 7, bonusIfLastQtePerfect: 5 },
  },
  {
    id: "aiko-boucle", type: "defense", rarity: "rare", characterId: "aiko",
    cost: { energy: 2 }, qte: 4,
    nameKey: "card.aiko-boucle.name", descriptionKey: "card.aiko-boucle.description",
    effect: { block: 40, varsSet: { keepPerfectStreak: 1 } },
  },
  {
    id: "aiko-serenite", type: "buff", rarity: "common", characterId: "aiko",
    cost: { mana: 1 }, qte: 0,
    nameKey: "card.aiko-serenite.name", descriptionKey: "card.aiko-serenite.description",
    effect: { selfStatuses: [{ id: "regen", duration: 2 }] },
  },
  // ----------------------------------------------------------------- ÉCHO ---
  {
    id: "echo-fleche", type: "attack-ranged", rarity: "rare", characterId: "echo",
    cost: { mana: 2 }, qte: 4,
    nameKey: "card.echo-fleche.name", descriptionKey: "card.echo-fleche.description",
    effect: {
      damage: 8,
      bonusPerMark: 4,
      targetStatuses: [{ id: "mark", duration: 2, stackable: true }],
    },
  },
  {
    id: "echo-vue", type: "buff", rarity: "rare", characterId: "echo",
    cost: { mana: 1 }, qte: 0,
    nameKey: "card.echo-vue.name", descriptionKey: "card.echo-vue.description",
    effect: { varsSet: { qteMinus: 1 } },
  },
  {
    id: "echo-piege", type: "defense", rarity: "common", characterId: "echo",
    cost: { mana: 2 }, qte: 4,
    nameKey: "card.echo-piege.name", descriptionKey: "card.echo-piege.description",
    effect: {
      block: 40,
      counterIfMelee: true,
      counterStatuses: [{ id: "mark", duration: 2, stackable: true }],
    },
  },
  // ------------------------------------------------------------------ NYRA ---
  {
    id: "nyra-blizzard", type: "attack-ranged", rarity: "rare", characterId: "nyra",
    cost: { mana: 4 }, qte: 5,
    nameKey: "card.nyra-blizzard.name", descriptionKey: "card.nyra-blizzard.description",
    effect: {
      damage: 12,
      targetStatuses: [{ id: "chill", duration: 1 }],
      selfStatuses: [{ id: "chill", duration: 1 }],
    },
  },
  {
    id: "nyra-flocon", type: "defense", rarity: "rare", characterId: "nyra",
    cost: { mana: 2 }, qte: 4,
    nameKey: "card.nyra-flocon.name", descriptionKey: "card.nyra-flocon.description",
    effect: {
      block: 30,
      counterDamage: 10,
      counterStatuses: [{ id: "chill", duration: 1 }],
    },
  },
  {
    id: "nyra-coeur", type: "buff", rarity: "common", characterId: "nyra",
    cost: { mana: 1 }, qte: 0,
    nameKey: "card.nyra-coeur.name", descriptionKey: "card.nyra-coeur.description",
    effect: { superGain: 15, varsSet: { chillImmune: 1 } },
  },
];

export const ALL_CARDS: CardDef[] = [...UNIVERSAL_CARDS, ...SIGNATURE_CARDS];

export const CARDS_BY_ID: ReadonlyMap<string, CardDef> = new Map(
  ALL_CARDS.map((c) => [c.id, c]),
);

export function getCard(id: string): CardDef {
  const card = CARDS_BY_ID.get(id);
  if (!card) throw new Error(`Carte inconnue : ${id}`);
  return card;
}
