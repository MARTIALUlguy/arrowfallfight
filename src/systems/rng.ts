// ============================================================================
// ARROWFALL — Générateur aléatoire déterministe (mulberry32)
// Permet des combats reproductibles si on seed (utile pour les tests du moteur).
// ============================================================================

export type Rng = () => number;

/** Crée un générateur pseudo-aléatoire à partir d'une graine. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG non seedé (jeu normal). */
export const random: Rng = Math.random;

/** Entier dans [min, max] inclus. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pioche un élément d'un tableau (non vide). */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Mélange une copie du tableau (Fisher-Yates). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** true avec probabilité p (0 → 1). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Graine dérivée de l'heure (comportement non déterministe). */
export function timeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
