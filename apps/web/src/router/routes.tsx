import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { lazyPage } from "./lazyPage";
import RouteErrorBoundary from "./RouteErrorBoundary";
import SimulationLayout from "./SimulationLayout";
import RisksLayout from "./RisksLayout";
import NotFoundPage from "./NotFoundPage";
import AppLayout from "@/shared/components/layout/AppLayout";

// The route tree lives in its own module (not index.tsx) so tests can build a
// createMemoryRouter from the exact same routes the app ships with, instead of
// re-declaring them — see router/routes.test.tsx.
//
// Every page below is code-split via lazyPage — see its own file for why. AppLayout
// carries the one Suspense boundary that covers all of them (its Header stays painted
// across navigations); SimulationLayout's tab bar sits inside that same boundary.

const DashboardPage = lazyPage(() => import("@/features/dashboard/pages/DashboardPage"));
const MapPage = lazyPage(() => import("@/features/map/pages/MapPage"));
const SimulationIndexPage = lazyPage(
  () => import("@/features/simulation/pages/SimulationIndexPage"),
);
const HeatSimulationPage = lazyPage(
  () => import("@/features/simulation/pages/HeatSimulationPage"),
);
const FloodSimulationPage = lazyPage(
  () => import("@/features/simulation/pages/FloodSimulationPage"),
);
const AQISimulationPage = lazyPage(
  () => import("@/features/simulation/pages/AQISimulationPage"),
);
const FloodPage = lazyPage(() => import("@/features/flood/pages/FloodPage"));
const HeatPage = lazyPage(() => import("@/features/heat/pages/HeatPage"));
const AirQualityPage = lazyPage(() => import("@/features/air-quality/pages/AirQualityPage"));
const AlertsPage = lazyPage(() => import("@/features/alerts/pages/AlertsPage"));
const RecommendationsPage = lazyPage(
  () => import("@/features/recommendations/pages/RecommendationsPage"),
);

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "map", element: <MapPage /> },
      {
        path: "simulation",
        element: <SimulationLayout />,
        children: [
          { index: true, element: <SimulationIndexPage /> },
          { path: "heat", element: <HeatSimulationPage /> },
          { path: "flood", element: <FloodSimulationPage /> },
          { path: "aqi", element: <AQISimulationPage /> },
        ],
      },
      {
        // Merged nav tab (user request 2026-09-24): the former separate "Flood" and
        // "Recommendations" tabs -> one, with a hazard sub-tab each carrying its own risk
        // detail + alerts + recommendations, matching the manuscript's presentation-layer
        // tile "Cảnh báo & khuyến nghị được xếp hạng" applied per hazard rather than globally.
        path: "risks",
        element: <RisksLayout />,
        children: [
          { index: true, element: <Navigate to="/risks/flood" replace /> },
          { path: "flood", element: <FloodPage /> },
          { path: "heat", element: <HeatPage /> },
          { path: "aqi", element: <AirQualityPage /> },
        ],
      },
      { path: "flood", element: <Navigate to="/risks/flood" replace /> },
      { path: "air-quality", element: <Navigate to="/risks/aqi" replace /> },
      // Kept URL-only (unfiltered, all hazards + "combined") — /risks/* embeds a
      // hazard-filtered HazardRecommendations instead of linking here.
      { path: "recommendations", element: <RecommendationsPage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
