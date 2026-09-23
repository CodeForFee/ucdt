import { Loader2 } from "lucide-react";

/**
 * Minimal fallback for a route's Suspense boundary while its chunk (lazyPage) downloads.
 * Lives in AppLayout so the header stays painted during navigation — see AppLayout.tsx.
 */
export default function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
