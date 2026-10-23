"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { LangSelector, useI18n } from "@/systems/i18n";
import { loadSave, resetSave, updateSettings, exportSaveJson, importSaveJson } from "@/systems/save";
import { playSound, startMusic, unlockAudio } from "@/systems/audio";

export default function OptionsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState(() => loadSave().settings);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [previewingMusic, setPreviewingMusic] = useState(false);
  const musicController = useRef<Awaited<ReturnType<typeof startMusic>> | null>(null);
  const musicTimer = useRef<number | null>(null);

  useEffect(() => {
    setSettings(loadSave().settings);
  }, []);

  useEffect(() => {
    musicController.current?.setVolume(settings.musicVolume);
  }, [settings.musicVolume]);

  useEffect(() => () => {
    musicController.current?.stop();
    if (musicTimer.current !== null) window.clearTimeout(musicTimer.current);
  }, []);

  const patch = (p: Partial<typeof settings>) => {
    const next = { ...settings, ...p };
    setSettings(next);
    updateSettings(p);
  };

  const previewSfx = async () => {
    try {
      await unlockAudio();
      playSound("perfect", settings.sfxVolume);
      setAudioError(null);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : t("options.audioError"));
    }
  };

  const previewMusic = async () => {
    if (musicController.current) {
      musicController.current.stop();
      musicController.current = null;
      if (musicTimer.current !== null) window.clearTimeout(musicTimer.current);
      musicTimer.current = null;
      setPreviewingMusic(false);
      return;
    }
    try {
      musicController.current = await startMusic(settings.musicVolume);
      setPreviewingMusic(true);
      setAudioError(null);
      musicTimer.current = window.setTimeout(() => {
        musicController.current?.stop();
        musicController.current = null;
        musicTimer.current = null;
        setPreviewingMusic(false);
      }, 6000);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : t("options.audioError"));
    }
  };

  const exportSave = () => {
    const blob = new Blob([exportSaveJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arrowfall-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importSave = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importSaveJson(await file.text());
      setSettings(imported.settings);
      setMessage(t("options.saveImportDone"));
      setMessageIsError(false);
    } catch (error) {
      setMessage(t("options.saveImportError"));
      setMessageIsError(true);
      console.error("Could not import ARROWFALL save:", error);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="neon-title font-display text-4xl font-bold tracking-widest">
          {t("options.title")}
        </h1>
        <Link href="/" className="text-sm text-night-600 hover:text-white">
          ← {t("common.back")}
        </Link>
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-night-700 bg-night-800/60 p-5">
        <div className="flex items-center justify-between">
          <span>{t("options.language")}</span>
          <LangSelector />
        </div>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm">
            {t("options.music")}
            <span className="text-night-600">{Math.round(settings.musicVolume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.musicVolume * 100)}
            onChange={(e) => patch({ musicVolume: Number(e.target.value) / 100 })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm">
            {t("options.sfx")}
            <span className="text-night-600">{Math.round(settings.sfxVolume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.sfxVolume * 100)}
            onChange={(e) => patch({ sfxVolume: Number(e.target.value) / 100 })}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void previewMusic()}
            className="rounded-lg border border-night-600 px-3 py-2 text-sm hover:border-neon-blue"
          >
            {previewingMusic ? t("options.stopMusicPreview") : t("options.musicPreview")}
          </button>
          <button
            type="button"
            onClick={() => void previewSfx()}
            className="rounded-lg border border-night-600 px-3 py-2 text-sm hover:border-neon-blue"
          >
            {t("options.sfxPreview")}
          </button>
        </div>
        {audioError && <p role="alert" className="text-sm text-neon-red">{audioError}</p>}

        <label className="flex items-center justify-between">
          <span>
            {t("options.zenMode")}
            <span className="block text-xs text-night-600">
              {t("options.zenModeDesc")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.zenMode}
            onChange={(e) => patch({ zenMode: e.target.checked })}
            className="h-5 w-5 accent-neon-blue"
          />
        </label>

        <label className="flex items-center justify-between gap-4">
          <span>{t("options.aiDifficulty")}</span>
          <select
            value={settings.aiDifficulty}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "easy" || value === "normal" || value === "hard") {
                patch({ aiDifficulty: value });
              }
            }}
            className="rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm"
          >
            {(["easy", "normal", "hard"] as const).map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {t(`options.difficulties.${difficulty}`)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-night-700 bg-night-800/60 p-5">
        <h2 className="font-display text-lg font-semibold">{t("options.saveData")}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportSave}
            className="rounded-lg border border-night-600 px-4 py-2 text-sm hover:border-neon-blue"
          >
            {t("options.exportSave")}
          </button>
          <label className="cursor-pointer rounded-lg border border-night-600 px-4 py-2 text-sm hover:border-neon-blue">
            {t("options.importSave")}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importSave(event)}
              className="sr-only"
            />
          </label>
        </div>
        {message && (
          <p role={messageIsError ? "alert" : "status"} className={`text-sm ${messageIsError ? "text-neon-red" : "text-neon-green"}`}>
            {message}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-night-700 bg-night-800/60 p-5">
        <button
          onClick={() => {
            if (window.confirm(t("options.resetConfirm"))) {
              resetSave();
              setSettings(loadSave().settings);
              setMessage(t("options.resetDone"));
              setMessageIsError(false);
            }
          }}
          className="rounded-lg border border-neon-red/60 px-4 py-2 text-neon-red transition-colors hover:bg-neon-red/10"
        >
          {t("options.reset")}
        </button>
      </section>
    </main>
  );
}
