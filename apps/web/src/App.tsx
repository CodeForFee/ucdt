import { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "react-router-dom";
import { IntlProvider } from "use-intl";
import { queryClient } from "@/shared/lib/queryClient";
import { useLocaleStore } from "@/shared/stores/localeStore";
import router from "@/router";
import vi from "@/messages/vi.json";
import en from "@/messages/en.json";

const MESSAGES = { vi, en } as const;

const App = () => {
  const locale = useLocaleStore((s) => s.locale);

  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale={locale} messages={MESSAGES[locale]}>
        {/* Route pages are code-split (lazyPage) and AppLayout carries its own
            Suspense boundary around <Outlet/>, so this one only ever covers the
            instant before AppLayout itself paints. */}
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
        <ReactQueryDevtools initialIsOpen={false} />
      </IntlProvider>
    </QueryClientProvider>
  );
};

export default App;
