import { DOCUMENT } from '@angular/common';
import { computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { LocalStorageService } from '../../core/services/local-storage.service';
import { STORAGE_KEYS } from '../../core/services/storage-keys';
import { ThemeMode, UiPrefs } from '../../data/models/quiz.models';

interface UiPrefsState {
  theme: ThemeMode;
  hydrated: boolean;
}

const initialState: UiPrefsState = {
  theme: 'dark',
  hydrated: false,
};

export const UiPrefsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isDarkMode: computed(() => store.theme() === 'dark'),
  })),
  withMethods((store, storage = inject(LocalStorageService), document = inject(DOCUMENT)) => ({
    hydrate(): void {
      const prefs = storage.readJson<UiPrefs>(STORAGE_KEYS.uiPrefs);
      if (prefs?.theme === 'light' || prefs?.theme === 'dark') {
        patchState(store, { theme: prefs.theme, hydrated: true });
        return;
      }

      patchState(store, { hydrated: true });
    },

    setTheme(theme: ThemeMode): void {
      patchState(store, { theme });
      storage.writeJson(STORAGE_KEYS.uiPrefs, { theme });
    },

    toggleTheme(): void {
      const next = store.theme() === 'dark' ? 'light' : 'dark';
      patchState(store, { theme: next });
      storage.writeJson(STORAGE_KEYS.uiPrefs, { theme: next });
    },

    applyThemeClass(): void {
      const body = document.body;
      body.classList.toggle('theme-dark', store.theme() === 'dark');
      body.classList.toggle('theme-light', store.theme() === 'light');
    },
  })),
  withHooks({
    onInit(store) {
      store.hydrate();
      effect(() => {
        store.theme();
        store.applyThemeClass();
      });
    },
  }),
);
