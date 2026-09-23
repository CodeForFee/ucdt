import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom keeps the document across tests in the same file, so a previous test's DOM tree
// is still there and a later query can match it by accident.
afterEach(() => {
  cleanup();
});

// jsdom 29 no longer ships its own localStorage — it defers to Node's experimental
// native implementation, which is only enabled behind a `--localstorage-file` CLI flag
// we don't pass. Without this, ThemeToggle and localeStore's zustand `persist` middleware
// (both real localStorage users) throw on every test that mounts them. A tiny in-memory
// shim is enough: nothing here needs it to actually persist across a page reload.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: memoryStorage,
    configurable: true,
  });
}

/**
 * jsdom has no EventSource. useLiveEvents() (mounted by AppLayout) constructs one on
 * every render, so route-render tests need a working stand-in even when they aren't
 * testing SSE directly — useLiveEvents.test.tsx uses the same class to dispatch a fake
 * `snapshot.updated` / `alert.created` message.
 */
export class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  private listeners = new Map<string, Set<(e: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.get(type)?.delete(cb);
  }

  close() {}

  /** Test helper: dispatch a named SSE event with a JSON-encoded payload. */
  emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.listeners.get(type)?.forEach((cb) => cb(event));
  }
}

vi.stubGlobal("EventSource", MockEventSource);
