import { useMapStore } from "@/shared/stores/mapStore";
import { useLocaleStore } from "@/shared/stores/localeStore";
import { MAP_LAYERS } from "@/shared/constants/mapLayers";
import { Layers } from "lucide-react";
import { useTranslations } from "use-intl";

export function LayerControls() {
  const { activeLayers, toggleLayer } = useMapStore();
  const locale = useLocaleStore((s) => s.locale);
  const m = useTranslations("map");

  return (
    <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg p-3 min-w-[160px]">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{m("layers")}</span>
      </div>
      <div className="space-y-2">
        {MAP_LAYERS.map((layer) => {
          const isActive = activeLayers.includes(layer.id);
          return (
            <button key={layer.id} onClick={() => toggleLayer(layer.id)} className="flex items-center gap-2 w-full text-left group">
              <div
                className={`h-3.5 w-3.5 rounded-sm border-2 transition-all shrink-0 ${isActive ? "border-transparent" : "border-border bg-transparent"}`}
                style={{ background: isActive ? layer.color : undefined }}
              />
              <span className={`text-xs transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {locale === "vi" ? layer.labelVi : layer.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
