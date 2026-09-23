import { Map, Satellite, Compass, RotateCcw } from "lucide-react";
import type { StyleKey } from "./useSimMap";
import { useTranslations } from "use-intl";

interface MapControlsProps {
  styleKey: StyleKey;
  onStyleChange: (key: StyleKey) => void;
  onReset2D: () => void;
  onReset3D?: () => void;
}

export function MapControls({ styleKey, onStyleChange, onReset2D, onReset3D }: MapControlsProps) {
  const mc = useTranslations("mapControls");

  const styles = [
    { key: "dark" as const, labelKey: "dark", icon: Map },
    { key: "satellite" as const, labelKey: "satellite", icon: Satellite },
    { key: "light" as const, labelKey: "light", icon: Map },
  ] as const;

  return (
    <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
      <div className="flex gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-1 border border-border shadow-lg">
        {styles.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onStyleChange(key)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              styleKey === key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {mc(labelKey)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-1 border border-border shadow-lg">
        <button
          onClick={onReset2D}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {mc("topDown")}
        </button>
        {onReset3D && (
          <button
            onClick={onReset3D}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Compass className="h-3.5 w-3.5" />
            {mc("view3D")}
          </button>
        )}
      </div>
    </div>
  );
}
