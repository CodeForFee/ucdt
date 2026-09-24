import { useTranslations } from "use-intl";

export function AQILegend() {
  const al = useTranslations("aqiLegend");

  const LEVELS = [
    { range: "0-50", labelKey: "good", bg: "#009966", text: "#fff" },
    { range: "51-100", labelKey: "moderate", bg: "#ffde33", text: "#333" },
    { range: "101-150", labelKey: "sensitive", bg: "#ff9933", text: "#fff" },
    { range: "151-200", labelKey: "unhealthy", bg: "#cc0033", text: "#fff" },
    { range: "201-300", labelKey: "veryUnhealthy", bg: "#660099", text: "#fff" },
    { range: "300+", labelKey: "hazardous", bg: "#7e0023", text: "#fff" },
  ] as const;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur-sm rounded-xl border border-border shadow-xl px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{al("title")}</p>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-white/60 bg-gray-400 opacity-50" />
            {al("actual")}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-yellow-400 bg-gray-400" />
            {al("simulated")}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-dashed border-slate-900 bg-white" />
            {al("observed")}
          </span>
        </div>
      </div>

      <div className="flex gap-1">
        {LEVELS.map((l) => (
          <div key={l.range} className="flex flex-col items-center gap-1">
            <div
              className="rounded-full flex items-center justify-center text-[9px] font-bold w-8 h-8 border-2 border-white/30"
              style={{ background: l.bg, color: l.text }}
            >
              {l.range.split("-")[0]}
            </div>
            <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[44px]">
              {al(l.labelKey)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
