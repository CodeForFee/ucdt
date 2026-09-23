import { Link } from "react-router-dom";
import { Droplets, Thermometer, Wind } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * Legacy redirected /simulation -> /simulation/flood. A bare redirect skips the
 * SimulationLayout tab bar's own landing state and gives up a real page for no benefit
 * over a link, so this is a light picker instead — same destinations, one extra click
 * saved by going straight to a card.
 */
export default function SimulationIndexPage() {
  const nav = useTranslations("nav");
  const ts = useTranslations("simulation");

  const CARDS = [
    { href: "/simulation/flood", label: ts("titleFlood"), desc: ts("floodDesc"), icon: Droplets, color: "text-blue-400" },
    { href: "/simulation/heat", label: ts("titleHeat"), desc: ts("heatDesc"), icon: Thermometer, color: "text-orange-400" },
    { href: "/simulation/aqi", label: ts("titleAqi"), desc: ts("aqiDesc"), icon: Wind, color: "text-green-400" },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-lg font-semibold">{nav("simulation")}</h1>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {CARDS.map(({ href, label, desc, icon: Icon, color }) => (
          <Link
            key={href}
            to={href}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-4 text-left transition-colors hover:bg-muted/60"
          >
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground">{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
