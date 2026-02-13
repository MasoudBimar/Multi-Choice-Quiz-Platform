import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly memoryStorage = new Map<string, string>();

  private readonly warningMessage = signal<string | null>(null);
  readonly warning = computed(() => this.warningMessage());

  private readonly usable = signal<boolean>(this.browser);
  readonly available = computed(() => this.usable());

  constructor() {
    if (!this.browser) {
      this.warningMessage.set('Persistent storage is unavailable. Running in memory-only mode.');
      this.usable.set(false);
      return;
    }

    try {
      const key = '__quiz_storage_probe__';
      window.localStorage.setItem(key, 'ok');
      window.localStorage.removeItem(key);
    } catch {
      this.usable.set(false);
      this.warningMessage.set('Local storage is unavailable. Progress will not persist across refresh.');
    }
  }

  getItem(key: string): string | null {
    if (!this.usable()) {
      return this.memoryStorage.get(key) ?? null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      this.fallbackToMemory('Could not read local storage. Using in-memory persistence.');
      return this.memoryStorage.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): boolean {
    if (!this.usable()) {
      this.memoryStorage.set(key, value);
      return true;
    }

    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      this.fallbackToMemory('Local storage is full or blocked. Using in-memory persistence.');
      this.memoryStorage.set(key, value);
      return false;
    }
  }

  removeItem(key: string): void {
    if (!this.usable()) {
      this.memoryStorage.delete(key);
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch {
      this.fallbackToMemory('Unable to remove data from local storage.');
      this.memoryStorage.delete(key);
    }
  }

  readJson<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  writeJson(key: string, value: unknown): boolean {
    return this.setItem(key, JSON.stringify(value));
  }

  private fallbackToMemory(message: string): void {
    this.usable.set(false);
    this.warningMessage.set(message);
  }
}
