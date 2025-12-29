"use client"

import type { Column, ColumnDef } from "@tanstack/react-table"
import { DataTableAdvancedToolbar } from "components/data-table/data-table-advanced-toolbar"
import { DataTableFilterMenu } from "components/data-table/data-table-filter-menu"
import { DataTablePagination } from "components/data-table/data-table-pagination"
import { DataTableSortList } from "components/data-table/data-table-sort-list"
import { RefreshCw } from "lucide-react"
import * as React from "react"

import { DataTable } from "~/components/data-table/data-table"
import { DataTableColumnHeader } from "~/components/data-table/data-table-column-header"
import { DataTableToolbar } from "~/components/data-table/data-table-toolbar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { useDataTable } from "~/hooks/use-data-table"

export interface ThreadUpdate {
  id: string
  webhook_name: string
  thread_id: string
  revision_number: number
  content: any
  timestamp: number
  status: "PENDING" | "SUCCESS" | "ERROR" | "SKIPPED"
}

interface WebhookDataTableProps {
  updates: ThreadUpdate[]
  pageCount?: number
  onRefresh?: () => void
  loading?: boolean
}

const statusVariants: Record<
  string,
  "success" | "error" | "pending" | "skipped"
> = {
  SUCCESS: "success",
  ERROR: "error",
  PENDING: "pending",
  SKIPPED: "skipped",
}

const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString()
}

export function WebhookDataTable({
  updates,
  pageCount = -1,
  onRefresh,
  loading,
}: WebhookDataTableProps) {
  // Count updates by status (for display only - server handles actual filtering)
  const statusCounts = React.useMemo(
    () => ({
      all: updates.length,
      success: updates.filter((u) => u.status === "SUCCESS").length,
      error: updates.filter((u) => u.status === "ERROR").length,
      pending: updates.filter((u) => u.status === "PENDING").length,
      skipped: updates.filter((u) => u.status === "SKIPPED").length,
    }),
    [updates]
  )

  const columns = React.useMemo<ColumnDef<ThreadUpdate>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "webhook_name",
        accessorKey: "webhook_name",
        header: ({ column }: { column: Column<ThreadUpdate, unknown> }) => (
          <DataTableColumnHeader column={column} label="Webhook" />
        ),
        cell: ({ cell }) => (
          <div className="font-medium">
            {cell.getValue<ThreadUpdate["webhook_name"]>()}
          </div>
        ),
        meta: {
          label: "Webhook",
        },
        enableColumnFilter: true,
      },
      {
        id: "thread_id",
        accessorKey: "thread_id",
        header: ({ column }: { column: Column<ThreadUpdate, unknown> }) => (
          <DataTableColumnHeader column={column} label="Thread ID" />
        ),
        cell: ({ cell }) => (
          <div className="font-mono text-xs">
            {cell.getValue<ThreadUpdate["thread_id"]>()}
          </div>
        ),
        meta: {
          label: "Thread ID",
          placeholder: "Search thread ID...",
        },
        enableColumnFilter: true,
      },
      {
        id: "revision_number",
        accessorKey: "revision_number",
        header: ({ column }: { column: Column<ThreadUpdate, unknown> }) => (
          <DataTableColumnHeader column={column} label="Revision" />
        ),
        cell: ({ cell }) => {
          const revision = cell.getValue<ThreadUpdate["revision_number"]>()
          return <div>{revision.toFixed(1)}</div>
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }: { column: Column<ThreadUpdate, unknown> }) => (
          <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: ({ cell }) => {
          const status = cell.getValue<ThreadUpdate["status"]>()
          return <Badge variant={statusVariants[status]}>{status}</Badge>
        },
        meta: {
          label: "Status",
          options: [
            { label: "Success", value: "SUCCESS" },
            { label: "Error", value: "ERROR" },
            { label: "Pending", value: "PENDING" },
            { label: "Skipped", value: "SKIPPED" },
          ],
        },
        enableColumnFilter: true,
      },
      {
        id: "timestamp",
        accessorKey: "timestamp",
        header: ({ column }: { column: Column<ThreadUpdate, unknown> }) => (
          <DataTableColumnHeader column={column} label="Timestamp" />
        ),
        cell: ({ cell }) => {
          const timestamp = cell.getValue<ThreadUpdate["timestamp"]>()
          // return <div className="text-sm">{formatTimestamp(timestamp)}</div>
          return <div className="text-sm">-</div>
        },
      },
      {
        id: "content",
        accessorKey: "content",
        header: "Content",
        cell: ({ cell }) => {
          const content = cell.getValue<ThreadUpdate["content"]>()
          return (
            <div className="max-w-xs">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          )
        },
        enableSorting: false,
      },
    ],
    []
  )

  const { table } = useDataTable({
    data: updates,
    columns,
    pageCount,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
      sorting: [{ id: "timestamp", desc: true }],
    },
    getRowId: (row) => row.id,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {updates.length} updates on this page
          </span>
          <span className="text-sm text-muted-foreground">
            ({statusCounts.success} success, {statusCounts.error} failed,{" "}
            {statusCounts.pending} pending)
          </span>
        </div>
        <Button
          onClick={onRefresh}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <DataTable table={table}>
        <DataTableAdvancedToolbar table={table}>
          <DataTableFilterMenu table={table} />
          <DataTableSortList table={table} />
        </DataTableAdvancedToolbar>
      </DataTable>
      <DataTablePagination table={table} />
    </div>
  )
}
