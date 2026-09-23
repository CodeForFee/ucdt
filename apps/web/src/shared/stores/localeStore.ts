import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "vi" | "en";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * UI-only, persisted client-side (no URL prefix — see BOARD/task T-005 decision to drop
 * next-intl's locale routing). Default 'vi'.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "vi",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "ucdt-locale" },
  ),
);
