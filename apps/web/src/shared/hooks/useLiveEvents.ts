import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { KEY } from "@/shared/utils/queryKeys";

interface SnapshotUpdatedPayload {
  hazard: string;
}

/**
 * One EventSource('/api/stream') for the whole app — mount this exactly once (in
 * AppLayout). Base-URL aware: an empty VITE_API_BASE_URL (the dev/same-origin default)
 * resolves to a relative /api/stream, which Vite's dev proxy and the prod reverse proxy
 * both forward.
 *
 * `snapshot.updated` invalidates the cached queries for the hazard that changed (via the
 * KEY registry in utils/queryKeys, so this can never drift from what the hooks key their
 * queries with). `alert.created` invalidates alerts. Reconnect on drop is EventSource's
 * own built-in retry — nothing to do here.
 */
export function useLiveEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(`${env.VITE_API_BASE_URL}/api/stream`);

    const onSnapshotUpdated = (event: MessageEvent<string>) => {
      let payload: SnapshotUpdatedPayload;
      try {
        payload = JSON.parse(event.data) as SnapshotUpdatedPayload;
      } catch {
        return; // malformed payload — nothing to invalidate
      }
      const key = KEY[payload.hazard as keyof typeof KEY];
      if (key) queryClient.invalidateQueries({ queryKey: [key] });
    };

    const onAlertCreated = () => {
      queryClient.invalidateQueries({ queryKey: [KEY.alerts] });
    };

    source.addEventListener("snapshot.updated", onSnapshotUpdated);
    source.addEventListener("alert.created", onAlertCreated);

    return () => {
      source.removeEventListener("snapshot.updated", onSnapshotUpdated);
      source.removeEventListener("alert.created", onAlertCreated);
      source.close();
    };
  }, [queryClient]);
}
