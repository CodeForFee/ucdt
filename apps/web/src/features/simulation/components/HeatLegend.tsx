import { useTranslations } from "use-intl";

/** Matches SimHeatLayer's circle-color temperature stops exactly. */
export function HeatLegend() {
  const hl = useTranslations("heatLegend");

  const LEVELS = [
    { temp: "<30°", bg: "#fde047", text: "#333" },
    { temp: "35°", bg: "#f97316", text: "#fff" },
    { temp: "38°", bg: "#ef4444", text: "#fff" },
    { temp: "42°+", bg: "#7f1d1d", text: "#fff" },
  ] as const;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur-sm rounded-xl border border-border shadow-xl px-3 py-2 space-y-2">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{hl("title")}</p>
      <div className="flex gap-1">
        {LEVELS.map((l) => (
          <div key={l.temp} className="flex flex-col items-center gap-1">
            <div
              className="rounded-full flex items-center justify-center text-[9px] font-bold w-9 h-9 border-2 border-white/30"
              style={{ background: l.bg, color: l.text }}
            >
              {l.temp}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
