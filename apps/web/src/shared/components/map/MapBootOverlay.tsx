import { Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * Overlay shown between the map container mounting and Mapbox GL firing its 'load'
 * event (first style + tiles fetched). Without it the user sees an empty/black frame
 * for a moment before the map draws — easy to mistake for an error. Unmounts as soon as
 * `map` is ready.
 */
export function MapBootOverlay() {
  const t = useTranslations("simulation");
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b1220] animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs font-medium text-muted-foreground">{t("loading")}</p>
      </div>
    </div>
  );
}
