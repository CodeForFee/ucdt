import { useTranslations } from "use-intl";
import { FullMapView } from "@/features/map/components/FullMapView";
import { LayerControls } from "@/features/map/components/LayerControls";
import { MapLegend } from "@/features/map/components/MapLegend";

export default function MapPage() {
  const nav = useTranslations("nav");
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Visually hidden — the map fills the page, but the route still needs an
          accessible, unique page title. */}
      <h1 className="sr-only">{nav("map")}</h1>
      <FullMapView />
      <LayerControls />
      <MapLegend />
    </div>
  );
}
