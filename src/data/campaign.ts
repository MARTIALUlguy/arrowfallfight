// ============================================================================
// ARROWFALL — Campagne : 8 chapitres, difficulté croissante, dialogues (clés i18n)
// ============================================================================

import type { AiDifficulty } from "@/types";

export interface ChapterDef {
  /** 1-based. */
  id: number;
  opponentId: string;
  difficulty: AiDifficulty;
  /** 2-3 cartes universelles débloquées à la victoire. */
  unlockCards: string[];
  /** Clés i18n des dialogues d'introduction (2-3 écrans). */
  introKeys: string[];
  victoryKey: string;
  defeatKey: string;
}

/** Ordre scénaristique des duels (du disciple au boss). */
export const CAMPAIGN_CHAPTERS: ChapterDef[] = [
  {
    id: 1, opponentId: "kael", difficulty: "easy",
    unlockCards: ["marteau-sismique", "premeditation"],
    introKeys: ["campaign.c1.intro.1", "campaign.c1.intro.2"],
    victoryKey: "campaign.c1.victory",
    defeatKey: "campaign.c1.defeat",
  },
  {
    id: 2, opponentId: "lyra", difficulty: "easy",
    unlockCards: ["danse-ombre", "adrenaline"],
    introKeys: ["campaign.c2.intro.1", "campaign.c2.intro.2"],
    victoryKey: "campaign.c2.victory",
    defeatKey: "campaign.c2.defeat",
  },
  {
    id: 3, opponentId: "sylphe", difficulty: "normal",
    unlockCards: ["fleche-perce-armure", "coup-critique"],
    introKeys: ["campaign.c3.intro.1", "campaign.c3.intro.2"],
    victoryKey: "campaign.c3.victory",
    defeatKey: "campaign.c3.defeat",
  },
  {
    id: 4, opponentId: "echo", difficulty: "normal",
    unlockCards: ["prisme-reflechissant", "vol-ether"],
    introKeys: ["campaign.c4.intro.1", "campaign.c4.intro.2"],
    victoryKey: "campaign.c4.victory",
    defeatKey: "campaign.c4.defeat",
  },
  {
    id: 5, opponentId: "nyra", difficulty: "normal",
    unlockCards: ["coup-bas", "purge"],
    introKeys: ["campaign.c5.intro.1", "campaign.c5.intro.2"],
    victoryKey: "campaign.c5.victory",
    defeatKey: "campaign.c5.defeat",
  },
  {
    id: 6, opponentId: "mordrak", difficulty: "hard",
    unlockCards: ["vengeance"],
    introKeys: ["campaign.c6.intro.1", "campaign.c6.intro.2", "campaign.c6.intro.3"],
    victoryKey: "campaign.c6.victory",
    defeatKey: "campaign.c6.defeat",
  },
  {
    id: 7, opponentId: "aiko", difficulty: "hard",
    unlockCards: ["echange-sanglant"],
    introKeys: ["campaign.c7.intro.1", "campaign.c7.intro.2"],
    victoryKey: "campaign.c7.victory",
    defeatKey: "campaign.c7.defeat",
  },
  {
    id: 8, opponentId: "vorn", difficulty: "hard",
    unlockCards: [],
    introKeys: ["campaign.c8.intro.1", "campaign.c8.intro.2", "campaign.c8.intro.3"],
    victoryKey: "campaign.c8.victory",
    defeatKey: "campaign.c8.defeat",
  },
];

export function getChapter(id: number): ChapterDef {
  const chapter = CAMPAIGN_CHAPTERS.find((c) => c.id === id);
  if (!chapter) throw new Error(`Chapitre inconnu : ${id}`);
  return chapter;
}
