// ============================================================================
// ARROWFALL — Définitions des 11 statuts
// `icon` = fragments SVG (chemin(s)) rendus dans un viewBox 24x24.
// ============================================================================

import type { StatusId } from "@/types";

export interface StatusDef {
  id: StatusId;
  nameKey: string;
  descriptionKey: string;
  color: string;
  /** Fragment SVG interne (chemins). Utiliser avec `stroke` si lignes fines. */
  icon: string;
  stroke?: boolean;
  /** Statut négatif (purgé par Purge/Méditation, ciblé par Fracasse-runique). */
  negative: boolean;
}

export const STATUSES: Record<StatusId, StatusDef> = {
  burn: {
    id: "burn",
    nameKey: "status.burn.name",
    descriptionKey: "status.burn.description",
    color: "#ff8a2a",
    icon: "M12 2c1.5 4-4 5.5-4 10a4 4 0 0 0 8 0c0-1.8-1-3-1-3s3.5 1.2 3.5 4.5A6.5 6.5 0 0 1 5.5 13.5C5.5 7.5 11 6 12 2z",
    negative: true,
  },
  bleed: {
    id: "bleed",
    nameKey: "status.bleed.name",
    descriptionKey: "status.bleed.description",
    color: "#ff3b5c",
    icon: "M12 3s6 7.2 6 11a6 6 0 0 1-12 0c0-3.8 6-11 6-11z",
    negative: true,
  },
  poison: {
    id: "poison",
    nameKey: "status.poison.name",
    descriptionKey: "status.poison.description",
    color: "#3ddc84",
    icon: "M9 2h6v3l3.5 8A5.5 5.5 0 0 1 12 20a5.5 5.5 0 0 1-6.5-7L9 5V2zm3 8v6m-3-3h6",
    stroke: true,
    negative: true,
  },
  chill: {
    id: "chill",
    nameKey: "status.chill.name",
    descriptionKey: "status.chill.description",
    color: "#3fd8ff",
    icon: "M12 2v20M4.2 6.5l15.6 11M19.8 6.5l-15.6 11M12 2l-2.2 2.2M12 2l2.2 2.2M12 22l-2.2-2.2M12 22l2.2-2.2M4.2 6.5L7 7.5M4.2 6.5l1-2.8M19.8 17.5l-2.8-1M19.8 17.5l-1 2.8M19.8 6.5L17 7.5M19.8 6.5l-1-2.8M4.2 17.5l2.8-1M4.2 17.5l1 2.8",
    stroke: true,
    negative: true,
  },
  stun: {
    id: "stun",
    nameKey: "status.stun.name",
    descriptionKey: "status.stun.description",
    color: "#ffd23f",
    icon: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1.5 1.5 0 1 0 1.5 1.5",
    stroke: true,
    negative: true,
  },
  shield: {
    id: "shield",
    nameKey: "status.shield.name",
    descriptionKey: "status.shield.description",
    color: "#9fd8ff",
    icon: "M12 2l8 3v6c0 5.2-3.4 9.4-8 11-4.6-1.6-8-5.8-8-11V5l8-3zm0 4.5V17",
    stroke: true,
    negative: false,
  },
  regen: {
    id: "regen",
    nameKey: "status.regen.name",
    descriptionKey: "status.regen.description",
    color: "#7dffa8",
    icon: "M12 21C7.2 16.6 3 13.2 3 8.7A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 9 2.3c0 4.5-4.2 7.9-9 12.3zM12 9v6m-3-3h6",
    stroke: true,
    negative: false,
  },
  weak: {
    id: "weak",
    nameKey: "status.weak.name",
    descriptionKey: "status.weak.description",
    color: "#9aa3b5",
    icon: "M6 2h12M6 22h12M7.5 2c0 4.5 3.5 5.5 3.5 8.5S7.5 14.5 7.5 19M16.5 2c0 4.5-3.5 5.5-3.5 8.5s3.5 3.5 3.5 7.5M7.5 8.5h9M7.5 15.5h9",
    stroke: true,
    negative: true,
  },
  haste: {
    id: "haste",
    nameKey: "status.haste.name",
    descriptionKey: "status.haste.description",
    color: "#f4f7ff",
    icon: "M13 2 4.5 13.5H11L9 22l8.5-11.5H12L13 2z",
    negative: false,
  },
  mark: {
    id: "mark",
    nameKey: "status.mark.name",
    descriptionKey: "status.mark.description",
    color: "#a05cff",
    icon: "M12 12m-8.5 0a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0M12 12m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
    stroke: true,
    negative: true,
  },
  silence: {
    id: "silence",
    nameKey: "status.silence.name",
    descriptionKey: "status.silence.description",
    color: "#6b4fd8",
    icon: "M3 3l18 18M12 4.5A7.5 7.5 0 0 1 19.5 12M12 4.5A7.5 7.5 0 0 0 4.5 12m15 0a7.5 7.5 0 0 1-7.5 7.5M4.5 12A7.5 7.5 0 0 0 12 19.5",
    stroke: true,
    negative: true,
  },
};

/** Ordre d'affichage sous les barres de HP. */
export const STATUS_ORDER: StatusId[] = [
  "burn",
  "bleed",
  "poison",
  "chill",
  "stun",
  "silence",
  "weak",
  "mark",
  "shield",
  "regen",
  "haste",
];

export const STATUS_IDS = Object.keys(STATUSES) as StatusId[];
