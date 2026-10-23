// ============================================================================
// ARROWFALL — Persistance localStorage (clé unique 'arrowfall_save_v1')
// Toutes les lectures sont protégées (SSR / mode privé / JSON corrompu).
// ============================================================================

import type { GameSettings, SaveData } from "@/types";

export const SAVE_KEY = "arrowfall_save_v1";

export function defaultSettings(): GameSettings {
  return {
    language: "fr",
    musicVolume: 0.7,
    sfxVolume: 0.8,
    zenMode: false,
    aiDifficulty: "easy",
  };
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: defaultSettings(),
    campaign: { completedChapters: [], unlockedCards: [] },
    records: {
      survivalBestWave: 0,
      totalMatches: 0,
      totalPerfects: 0,
      bestPerfectStreak: 0,
    },
    customDecks: {},
    survivalRun: null,
    tutorialSeen: false,
  };
}

function isSurvivalRun(value: unknown): value is NonNullable<SaveData["survivalRun"]> {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Record<string, unknown>;
  const numericFields = [
    "wave", "hp", "maxHp", "energy", "maxEnergy", "mana", "maxMana",
    "superGauge", "maxHandSize", "bonusAppliedWave",
  ];
  return typeof run.characterId === "string"
    && numericFields.every((field) => typeof run[field] === "number" && Number.isFinite(run[field]))
    && Number.isInteger(run.wave) && Number(run.wave) >= 1
    && Number(run.hp) >= 0 && Number(run.maxHp) > 0
    && Number(run.energy) >= 0 && Number(run.maxEnergy) >= 0
    && Number(run.mana) >= 0 && Number(run.maxMana) >= 0
    && Number(run.superGauge) >= 0 && Number(run.superGauge) <= 100
    && Number(run.maxHandSize) >= 1
    && Number.isInteger(run.bonusAppliedWave) && Number(run.bonusAppliedWave) >= 0
    && Array.isArray(run.deck) && run.deck.every((card) => typeof card === "string")
    && Array.isArray(run.bonuses) && run.bonuses.every((bonus) => typeof bonus === "string")
    && (typeof run.lastBonus === "string" || run.lastBonus === null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function boundedVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

/** Folds older or partially corrupted saves into the current schema. */
function mergeSave(input: unknown): SaveData {
  const base = defaultSave();
  const raw = isRecord(input) ? input : {};
  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  const savedDifficulty = rawSettings.aiDifficulty;
  const aiDifficulty = savedDifficulty === "easy"
    || savedDifficulty === "normal"
    || savedDifficulty === "hard"
    ? savedDifficulty
    : base.settings.aiDifficulty;
  const rawCampaign = isRecord(raw.campaign) ? raw.campaign : {};
  const rawRecords = isRecord(raw.records) ? raw.records : {};
  const rawDecks = isRecord(raw.customDecks) ? raw.customDecks : {};
  const customDecks = Object.fromEntries(
    Object.entries(rawDecks).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((card) => typeof card === "string"),
    ),
  );
  return {
    version: 1,
    settings: {
      language: rawSettings.language === "en" || rawSettings.language === "fr"
        ? rawSettings.language
        : base.settings.language,
      musicVolume: boundedVolume(rawSettings.musicVolume, base.settings.musicVolume),
      sfxVolume: boundedVolume(rawSettings.sfxVolume, base.settings.sfxVolume),
      zenMode: typeof rawSettings.zenMode === "boolean" ? rawSettings.zenMode : base.settings.zenMode,
      aiDifficulty,
    },
    campaign: {
      completedChapters: Array.isArray(rawCampaign.completedChapters)
        ? rawCampaign.completedChapters.filter((chapter): chapter is number =>
          typeof chapter === "number" && Number.isInteger(chapter) && chapter >= 1 && chapter <= 8,
        )
        : base.campaign.completedChapters,
      unlockedCards: Array.isArray(rawCampaign.unlockedCards)
        ? rawCampaign.unlockedCards.filter((card): card is string => typeof card === "string")
        : base.campaign.unlockedCards,
    },
    records: {
      survivalBestWave: finiteCount(rawRecords.survivalBestWave, base.records.survivalBestWave),
      totalMatches: finiteCount(rawRecords.totalMatches, base.records.totalMatches),
      totalPerfects: finiteCount(rawRecords.totalPerfects, base.records.totalPerfects),
      bestPerfectStreak: finiteCount(rawRecords.bestPerfectStreak, base.records.bestPerfectStreak),
    },
    customDecks,
    survivalRun: isSurvivalRun(raw.survivalRun) ? raw.survivalRun : null,
    tutorialSeen: typeof raw.tutorialSeen === "boolean" ? raw.tutorialSeen : false,
  };
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return mergeSave(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Stockage indisponible : le jeu continue sans persistance.
  }
}

/** Met à jour partiellement la sauvegarde et la réécrit. Retourne la nouvelle valeur. */
export function updateSave(patch: Partial<SaveData>): SaveData {
  const next = mergeSave({ ...loadSave(), ...patch });
  writeSave(next);
  return next;
}

export function exportSaveJson(): string {
  return JSON.stringify(loadSave(), null, 2);
}

export function importSaveJson(serialized: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  if (
    !isRecord(parsed)
    || parsed.version !== 1
    || !isRecord(parsed.settings)
    || !isRecord(parsed.campaign)
    || !isRecord(parsed.records)
    || !isRecord(parsed.customDecks)
  ) {
    throw new Error("The selected file is not an ARROWFALL save.");
  }
  const next = mergeSave(parsed);
  if (typeof window === "undefined") throw new Error("Save import requires a browser.");
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("The browser could not store the imported save.");
  }
  return next;
}

export function updateSettings(patch: Partial<GameSettings>): SaveData {
  const current = loadSave();
  return updateSave({ settings: { ...current.settings, ...patch } });
}

export function resetSave(): SaveData {
  const fresh = defaultSave();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
  }
  return fresh;
}

/** Deck personnalisé d'un personnage (null si jamais modifié ou invalide). */
export function getCustomDeck(characterId: string): string[] | null {
  const deck = loadSave().customDecks[characterId];
  return deck && deck.length === 20 ? deck : null;
}

export function setCustomDeck(characterId: string, cards: string[]): SaveData {
  const current = loadSave();
  return updateSave({
    customDecks: { ...current.customDecks, [characterId]: cards },
  });
}
