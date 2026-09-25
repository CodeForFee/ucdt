import { useTranslations } from "use-intl";

/** Matches FloodExtrusion3D's fill-extrusion-color depth stops exactly. */
export function FloodLegend() {
  const fl = useTranslations("floodLegend");

  const LEVELS = [
    { depth: "0m", bg: "#93c5fd", text: "#1e3a8a" },
    { depth: "0.3m", bg: "#3b82f6", text: "#fff" },
    { depth: "0.6m", bg: "#1d4ed8", text: "#fff" },
    { depth: "0.8m+", bg: "#ef4444", text: "#fff" },
  ] as const;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur-sm rounded-xl border border-border shadow-xl px-3 py-2 space-y-2">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{fl("title")}</p>
      <div className="flex gap-1">
        {LEVELS.map((l) => (
          <div key={l.depth} className="flex flex-col items-center gap-1">
            <div
              className="rounded-full flex items-center justify-center text-[9px] font-bold w-9 h-9 border-2 border-white/30"
              style={{ background: l.bg, color: l.text }}
            >
              {l.depth}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
