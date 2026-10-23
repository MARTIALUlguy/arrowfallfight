// ============================================================================
// ARROWFALL — i18n maison : contexte React + sélecteur de langue persistant
// Usage : const { t, ta, lang, setLang } = useI18n();
//   t("menu.campaign")           -> string
//   t("common.turn", { n: 3 })   -> string avec interpolation
//   ta("character.kael.quotes.attack") -> string[]
// ============================================================================

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fr, type Messages } from "@/i18n/fr";
import { en } from "@/i18n/en";
import { loadSave, updateSettings } from "./save";

export type Lang = "fr" | "en";

const DICTS: Record<Lang, Messages> = { fr, en };

type DictValue = string | string[] | Dict | Dict[];
interface Dict {
  [key: string]: DictValue;
}

function resolve(dict: Messages, path: string): DictValue | undefined {
  const parts = path.split(".");
  let current: DictValue = dict as unknown as Dict;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Dict)[part];
  }
  return current;
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  ta: (key: string) => string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = loadSave().settings.language;
    return saved === "en" ? "en" : "fr";
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    updateSettings({ language: next });
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      t: (key, params) => {
        const found = resolve(dict, key);
        if (typeof found === "string") return interpolate(found, params);
        if (found === undefined) {
          // Fallback FR en dev, clé brute en prod pour rester visible.
          const fallback = resolve(fr, key);
          return typeof fallback === "string" ? interpolate(fallback, params) : key;
        }
        return key;
      },
      ta: (key) => {
        const found = resolve(dict, key);
        if (Array.isArray(found) && found.every((v) => typeof v === "string")) {
          return found as string[];
        }
        const fallback = resolve(fr, key);
        return Array.isArray(fallback) ? (fallback as string[]) : [];
      },
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé sous <I18nProvider>");
  return ctx;
}

/** Petit composant sélecteur FR/EN réutilisable (Options, menu…). */
export function LangSelector() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex gap-1 rounded-lg border border-night-600 bg-night-800 p-1">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-md px-3 py-1 text-sm font-semibold uppercase transition-colors ${
            lang === l
              ? "bg-neon-blue text-night-950"
              : "text-night-600 hover:text-white"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
