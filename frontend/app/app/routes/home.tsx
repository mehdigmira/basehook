import { useState, useEffect } from "react"
import type { Route } from "./+types/home"
import { useQueryState, parseAsInteger, parseAsString } from "nuqs"
import { WebhookDataTable, type ThreadUpdate } from "~/components/webhook-data-table"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Basehook Dashboard" },
    { name: "description", content: "Monitor received updates" },
  ]
}


export default function Home() {
  const [updates, setUpdates] = useState<ThreadUpdate[]>([])
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)

  // Each useQueryState automatically triggers re-render when URL changes
  const [page] = useQueryState("page", parseAsInteger.withDefault(1))
  const [filters, setFilters] = useQueryState("filters", parseAsString)
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
        // Build request body for Python backend
        const requestBody: any = {
          page,
          per_page: perPage,
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
  }, [page, perPage, filters, sort]) // Re-fetch when any param changes

  const handleRefresh = () => {
    // Re-fetch data by toggling a dependency (force re-fetch)
    const currentPage = page
    // Trigger re-fetch by updating query params slightly
    window.location.reload()
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
        requestBody.ids = selectedIds.map(id => parseInt(id))
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground">
            Monitor and manage webhook thread updates
          </p>
        </div>

        <WebhookDataTable
          updates={updates}
          pageCount={pageCount}
          onRefresh={handleRefresh}
          loading={loading}
          onBulkAction={handleBulkAction}
        />
      </div>
    </div>
  )
}
