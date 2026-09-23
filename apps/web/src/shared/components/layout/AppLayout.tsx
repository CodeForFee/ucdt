import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import PageLoader from "./PageLoader";
import { useLiveEvents } from "@/shared/hooks/useLiveEvents";

/** Ported from Hackathon-FE app/[locale]/(main)/layout.tsx + Header. Mounts the single
 *  app-wide EventSource('/api/stream') once here — see useLiveEvents.ts. */
export default function AppLayout() {
  useLiveEvents();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden">
        {/* Keeps the header painted while a route's chunk downloads, instead of
            suspending the whole app up at App.tsx's top-level boundary. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
