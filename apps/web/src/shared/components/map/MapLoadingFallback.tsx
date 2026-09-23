import { Loader2, MapPinned } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * Fallback shown while a simulation map page's chunk is still downloading (lazyPage),
 * before the real map component mounts. Shares visual language (card + backdrop-blur +
 * border) with MapControls/SidebarShell so there's no style "flash" once the real map
 * takes over.
 */
export function MapLoadingFallback() {
  const t = useTranslations("simulation");
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b1220]">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/90 px-6 py-5 shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <MapPinned className="h-5 w-5 text-primary" />
            <Loader2 className="absolute h-10 w-10 animate-spin text-primary/30" />
          </div>
          <p className="text-sm font-medium text-foreground">{t("loading")}</p>
        </div>
      </div>
    </div>
  );
}
