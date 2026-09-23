import { Link, Outlet, useLocation } from "react-router-dom";
import { Droplets, Thermometer, Wind } from "lucide-react";
import { useTranslations } from "use-intl";

/**
 * Ported from Hackathon-FE app/[locale]/(main)/simulation/layout.tsx. Router-local (not
 * under src/features/simulation/) because T-005's scope inside features/** is limited to
 * placeholder pages — this tab bar is shell wiring, not feature UI.
 */
export default function SimulationLayout() {
  const t = useTranslations("simulation");
  const { pathname } = useLocation();

  const TABS = [
    {
      href: "/simulation/flood",
      label: t("flood"),
      icon: Droplets,
      active: "text-blue-400 border-blue-400",
      inactive: "text-muted-foreground border-transparent hover:text-blue-300",
    },
    {
      href: "/simulation/heat",
      label: t("heat"),
      icon: Thermometer,
      active: "text-orange-400 border-orange-400",
      inactive: "text-muted-foreground border-transparent hover:text-orange-300",
    },
    {
      href: "/simulation/aqi",
      label: t("aqi"),
      icon: Wind,
      active: "text-green-400 border-green-400",
      inactive: "text-muted-foreground border-transparent hover:text-green-300",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-0 border-b border-border bg-card/60 backdrop-blur-sm px-4">
        {TABS.map(({ href, label, icon: Icon, active, inactive }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              to={href}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive ? active : inactive}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <Outlet />
      </div>
    </div>
  );
}
