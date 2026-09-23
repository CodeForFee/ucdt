import { QueryClient } from "@tanstack/react-query";

// Defaults per T-005 task spec: match KLTN_dev-v2/frontend's App.tsx QueryClient, not
// Hackathon-FE's (which used staleTime 2min/retry 2 with no gcTime/refetchOnWindowFocus
// override).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
