import { lazy, type ComponentType } from "react";

/** Reload-once guard: only ever retries a stale chunk one time per tab. */
const RELOAD_FLAG = "chunkReloadedOnce";

function session(op: (s: Storage) => void) {
  // Private mode / blocked storage throws on the read itself — swallow it, we just
  // lose the anti-loop guard.
  try {
    op(window.sessionStorage);
  } catch {
    /* no storage available */
  }
}

/**
 * `lazy()` with self-healing after a deploy.
 *
 * Chunk filenames embed a content hash, so a new deploy produces new names and drops
 * the old ones. A tab that was already open still holds the old index.html in memory,
 * and the first navigation to a page it hasn't visited yet tries to fetch a chunk that
 * no longer exists — a blank page that only a hard reload fixes.
 *
 * Reloading is the only real fix: only a fresh index.html knows the new hash list. Only
 * one retry, because if the chunk is broken for another reason (dead network, a real
 * bad file) an infinite reload loop is worse than a blank page — the second failure
 * surfaces through the error boundary instead.
 */
export function lazyPage<T extends ComponentType<unknown>>(
  load: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await load();
      // Made it in — current chunk is healthy, so re-arm the reload guard for the
      // next deploy.
      session((s) => s.removeItem(RELOAD_FLAG));
      return mod;
    } catch (error) {
      let alreadyTried = true;
      session((s) => {
        alreadyTried = s.getItem(RELOAD_FLAG) !== null;
        if (!alreadyTried) s.setItem(RELOAD_FLAG, "1");
      });
      if (alreadyTried) throw error;

      window.location.reload();
      // Hang forever: reload() doesn't stop this thread, so returning here would let
      // React render the error boundary for the instant before the browser navigates.
      return new Promise<never>(() => {});
    }
  });
}
