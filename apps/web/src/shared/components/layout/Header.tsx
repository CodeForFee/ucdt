import { Link, useLocation } from "react-router-dom";
import { Activity, LayoutDashboard, Map, FlaskConical, Droplets } from "lucide-react";
import { useTranslations } from "use-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocaleStore } from "@/shared/stores/localeStore";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const t = useTranslations("nav");
  const { locale, setLocale } = useLocaleStore();
  const { pathname } = useLocation();
  const [currentTime, setCurrentTime] = useState("");

  // Air quality and alerts already live on the dashboard (AQISummaryCard /
  // AlertsSummaryCard) so they don't get their own tab — BOARD Decision 2026-09-14.
  // Their detail pages stay reachable by URL.
  const NAV_ITEMS = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/map", label: t("map"), icon: Map },
    { href: "/simulation", label: t("simulation"), icon: FlaskConical },
    { href: "/flood", label: t("flood"), icon: Droplets },
  ];

  useEffect(() => {
    const localeStr = locale === "vi" ? "vi-VN" : "en-US";
    const update = () =>
      setCurrentTime(
        new Date().toLocaleTimeString(localeStr, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [locale]);

  return (
    <header className="h-12 shrink-0 border-b border-border bg-card/90 backdrop-blur-sm z-50">
      <div className="h-full max-w-[1600px] mx-auto flex items-center px-4 gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0 mr-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold hidden sm:block whitespace-nowrap">
            {t("appName")}
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                to={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden md:block">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <span className="hidden lg:block text-xs text-muted-foreground font-mono tabular-nums">
          {currentTime}
        </span>

        <div className="flex items-center h-7 rounded-md border border-border overflow-hidden text-xs font-medium">
          <button
            type="button"
            onClick={() => setLocale("vi")}
            className={cn(
              "px-2.5 h-full transition-colors",
              locale === "vi"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            VN
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={cn(
              "px-2.5 h-full transition-colors",
              locale === "en"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            EN
          </button>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
