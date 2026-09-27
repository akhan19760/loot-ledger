import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

// Placeholder shell: proves web -> Vite proxy -> Fastify works.
// Replaced by the real library UI in the frontend phase.
export default function App() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health })

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Game Library</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        API:{" "}
        {health.isPending
          ? "checking…"
          : health.isError
            ? `unreachable (${health.error.message})`
            : `ok at ${new Date(health.data.time).toLocaleTimeString()}`}
      </p>
      <Button className="mt-4" variant="outline" onClick={() => health.refetch()}>
        Ping API
      </Button>
    </main>
  )
}
