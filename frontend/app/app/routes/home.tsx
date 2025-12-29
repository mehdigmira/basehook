import { useState, useEffect } from "react"
import type { Route } from "./+types/home"
import { useQueryState, parseAsInteger, parseAsString, parseAsArrayOf } from "nuqs"
import { WebhookDataTable, type ThreadUpdate } from "~/components/webhook-data-table"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Basehook Dashboard" },
    { name: "description", content: "Monitor webhook updates and threads" },
  ]
}

function generateDummyData(): ThreadUpdate[] {
  const webhooks = ["test", "production", "staging", "development"]
  const statuses: Array<"PENDING" | "SUCCESS" | "ERROR" | "SKIPPED"> = ["PENDING", "SUCCESS", "ERROR", "SKIPPED"]
  const now = Date.now() / 1000

  const data: ThreadUpdate[] = []

  for (let i = 0; i < 100; i++) {
    const webhook = webhooks[Math.floor(Math.random() * webhooks.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const threadId = `thread-${Math.floor(Math.random() * 20) + 1}`
    const revision = Math.random() * 10

    data.push({
      id: `${i}`,
      webhook_name: webhook,
      thread_id: threadId,
      revision_number: revision,
      content: {
        thread_id: threadId,
        revision: revision,
        data: `Update ${i}`,
        payload: {
          event: "webhook.received",
          timestamp: now - (Math.random() * 86400),
          metadata: {
            source: webhook,
            processed: status === "SUCCESS"
          }
        }
      },
      timestamp: now - (Math.random() * 86400),
      status: status,
    })
  }

  return data.sort((a, b) => b.timestamp - a.timestamp)
}

export default function Home() {
  const [updates, setUpdates] = useState<ThreadUpdate[]>([])
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)

  // Each useQueryState automatically triggers re-render when URL changes
  const [page] = useQueryState("page", parseAsInteger.withDefault(1))
  const [filters] = useQueryState("filters", parseAsString)
  const [sort] = useQueryState("sort", parseAsString)
  const [perPage] = useQueryState("perPage", parseAsInteger.withDefault(10))

  useEffect(() => {
    console.log("[Client] Params changed:", { page, filters, sort })
  }, [page, filters, sort])

  // Fetch data whenever URL params change (managed by useDataTable)
  useEffect(() => {
    const fetchUpdates = async () => {
      setLoading(true)
      try {
        // Build query params for Python backend
        const apiParams = new URLSearchParams()
        apiParams.set("page", page.toString())
        apiParams.set("per_page", perPage.toString())

        if (filters) apiParams.set("filters", filters)
        if (sort) apiParams.set("sort", sort)

        console.log("[Client] Fetching with params:", { page, perPage, filters, sort })

        const response = await fetch(`/api/thread-updates?${apiParams}`)

        if (!response.ok) {
          throw new Error("Failed to fetch updates")
        }

        const data = await response.json()

        // Expected response format from Python backend:
        // { "updates": [...], "total": 123 }
        setUpdates(data.updates || [])
        setPageCount(Math.ceil((data.total || 0) / perPage))

        console.log("[Client] Fetched from backend:", {
          total: data.total,
          updateCount: data.updates?.length || 0
        })
      } catch (error) {
        console.error("Failed to fetch updates, using dummy data:", error)

        // Fallback to dummy data
        const dummyData = generateDummyData()

        // Apply pagination
        const start = (page - 1) * perPage
        const paginated = dummyData.slice(start, start + perPage)

        setUpdates(paginated)
        setPageCount(Math.ceil(dummyData.length / perPage))

        console.log("[Client] Using dummy data:", {
          total: dummyData.length,
          updateCount: paginated.length
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUpdates()
  }, [page, perPage, filters, sort]) // Re-fetch when any param changes

  const handleRefresh = () => {
    // Trigger re-fetch by updating a dependency
    window.location.reload()
  }

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage webhook thread updates
          </p>
        </div>

        <WebhookDataTable
          updates={updates}
          pageCount={pageCount}
          onRefresh={handleRefresh}
          loading={loading}
        />
      </div>
    </div>
  )
}
