import { QueryClient } from "@tanstack/react-query"

// Catalog data only changes when the server's scheduled refresh runs,
// so cached responses stay fresh for a while and aren't refetched on tab focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
