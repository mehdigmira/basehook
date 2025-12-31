import { useState, useEffect } from "react"
import type { Route } from "./+types/home"
import { useQueryState, parseAsInteger, parseAsString, parseAsJson } from "nuqs"
import { WebhookDataTable, type ThreadUpdate } from "~/components/webhook-data-table"
import { RefreshCw } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { generateId } from "~/lib/id"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Basehook Dashboard" },
    { name: "description", content: "Monitor received updates" },
  ]
}


export default function Home() {
  const [updates, setUpdates] = useState<ThreadUpdate[]>([])
  const [pageCount, setPageCount] = useState(1)
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Each useQueryState automatically triggers re-render when URL changes
  const [page] = useQueryState("page", parseAsInteger.withDefault(1))
  const [filters, setFilters] = useQueryState("filters", parseAsJson<any[]>((v) => Array.isArray(v) ? v : []).withDefault([]))
  const [sort] = useQueryState("sort", parseAsJson<any[]>((v) => Array.isArray(v) ? v : []).withDefault([]))
  const [perPage] = useQueryState("perPage", parseAsInteger.withDefault(10))
  const [timeRange, setTimeRange] = useQueryState("range", parseAsString.withDefault("all"))

  useEffect(() => {
    console.log("[Client] Params changed:", { page, filters, sort })
  }, [page, filters, sort])

  // Fetch data whenever URL params change (managed by useDataTable)
  useEffect(() => {
    const fetchUpdates = async () => {
      setLoading(true)
      try {
        // Build request body for Python backend
        const requestBody: any = {
          page,
          per_page: perPage,
          range: timeRange,
        }

        // Parse and add filters if present
        if (filters) {
          requestBody.filters = filters
        }

        // Parse and add sort if present
        if (sort) {
          requestBody.sort = sort
        }

        console.log("[Client] Fetching with body:", requestBody)

        const response = await fetch("/api/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch updates")
        }

        const data = await response.json()

        // Expected response format from Python backend:
        // { "updates": [...], "total": 123, "page": 1, "per_page": 10, "total_pages": 13 }
        setUpdates(data.updates || [])
        setPageCount(data.total_pages || Math.ceil((data.total || 0) / perPage))
        setRowCount(data.total || 0)

        console.log("[Client] Fetched from backend:", {
          total: data.total,
          totalPages: data.total_pages,
          updateCount: data.updates?.length || 0
        })
      } catch (error) {
        console.error("Failed to fetch updates")

  
      } finally {
        setLoading(false)
      }
    }

    fetchUpdates()
  }, [page, perPage, filters, sort, timeRange]) // Re-fetch when any param changes

  const handleRefresh = () => {
    // Re-fetch data by forcing a window reload
    window.location.reload()
  }

  const handleThreadIdClick = (threadId: string) => {
    // Set filter for thread_id with history push
    setFilters([{id: "thread_id", value: threadId, variant: "text", operator: "eq", filterId: generateId({ length: 8 })}], { history: "push" })
  }

  const handleBulkAction = async (action: "reenqueue" | "skip", isAllSelected: boolean, selectedIds: number[]) => {
    try {
      // Map action to status
      const newStatus = action === "skip" ? "skipped" : "pending"
      const newStatusUpper = newStatus.toUpperCase()

      const requestBody: any = {
        status: newStatusUpper,
      }

      if (isAllSelected) {
        // Send filters to update all matching records
        if (filters) {
          requestBody.filters = filters
        }
      } else {
        // Send specific IDs
        requestBody.ids = selectedIds
      }

      // Optimistic update - update UI immediately
      setUpdates(prevUpdates => {
        return prevUpdates.map(update => {
          // Check if this update should be updated
          const shouldUpdate = isAllSelected
            ? true // Update all for now (filter matching would be complex)
            : selectedIds.includes(update.id)

          if (shouldUpdate) {
            return { ...update, status: newStatus as ThreadUpdate["status"] }
          }
          return update
        })
      })

      const response = await fetch("/api/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error("Failed to update status")
        // Revert optimistic update on error
        // Could re-fetch here, but for now just log
      }

      const data = await response.json()
      console.log(`[Client] Updated ${data.updated} records to ${newStatusUpper}`)
    } catch (error) {
      console.error("[Client] Failed to update status:", error)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
            <p className="text-muted-foreground">
              Monitor and manage webhook thread updates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>

        <WebhookDataTable
          updates={updates}
          pageCount={pageCount}
          rowCount={rowCount}
          onBulkAction={handleBulkAction}
          onThreadIdClick={handleThreadIdClick}
        />
      </div>
    </div>
  )
}
