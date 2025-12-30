"use client"

import type { Column, ColumnDef, Table } from "@tanstack/react-table"
import { DataTableAdvancedToolbar } from "components/data-table/data-table-advanced-toolbar"
import { DataTableFilterMenu } from "components/data-table/data-table-filter-menu"
import { DataTablePagination } from "components/data-table/data-table-pagination"
import { DataTableSortList } from "components/data-table/data-table-sort-list"
import { RotateCcw, SkipForward, AlertCircle, ChartNoAxesColumn, ChartNoAxesGantt } from "lucide-react"
import * as React from "react"

import { DataTable } from "~/components/data-table/data-table"
import { DataTableColumnHeader } from "~/components/data-table/data-table-column-header"
import { DataTableToolbar } from "~/components/data-table/data-table-toolbar"
import { ActionBar } from "~/components/ui/action-bar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { useDataTable } from "~/hooks/use-data-table"
import { TooltipContent, Tooltip, TooltipTrigger } from "./ui/tooltip"

export interface ThreadUpdate {
  id: number
  webhook_name: string
  thread_id: string
  revision_number: number
  content: any
  timestamp: number
  status: "pending" | "success" | "error" | "skipped"
  traceback?: string | null
}

interface WebhookDataTableProps {
  updates: ThreadUpdate[]
  pageCount?: number,
  rowCount?: number,
  onBulkAction?: (action: "reenqueue" | "skip", isAllSelected: boolean, selectedIds: number[]) => void
}


const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString()
}

function TableActionBar({
  table,
  isAllSelected,
  onAction,
}: {
  table: Table<ThreadUpdate>
  isAllSelected: boolean
  onAction: (action: "reenqueue" | "skip", isAllSelected: boolean, selectedIds: number[]) => void
}) {
  const rows = table.getFilteredSelectedRowModel().rows
  const selectedCount = isAllSelected ? "all" : rows.length

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        table.toggleAllRowsSelected(false)
      }
    },
    [table]
  )

  const handleAction = (action: "reenqueue" | "skip") => {
    const selectedIds = rows.map((r) => r.original.id)
    onAction(action, isAllSelected, selectedIds)
    table.toggleAllRowsSelected(false)
  }

  return (
    <ActionBar open={rows.length > 0 || isAllSelected} onOpenChange={onOpenChange}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount === "all" ? "All updates" : `${selectedCount} update${selectedCount === 1 ? "" : "s"}`} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={() => handleAction("reenqueue")}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Re-queue
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleAction("skip")}>
          <SkipForward className="mr-2 h-4 w-4" />
          Skip
        </Button>
      </div>
    </ActionBar>
  )
}

export function WebhookDataTable({
  updates,
  pageCount = -1,
  rowCount = 0,
  onBulkAction,
}: WebhookDataTableProps) {
  const [isAllSelected, setIsAllSelected] = React.useState(false)
  const [tracebackDialog, setTracebackDialog] = React.useState<{ open: boolean; traceback: string | null }>({
    open: false,
    traceback: null,
  })

  const handleBulkAction = (action: "reenqueue" | "skip", isAll: boolean, selectedIds: number[]) => {
    onBulkAction?.(action, isAll, selectedIds)
    setIsAllSelected(false)
  }

  const columns = React.useMemo<ColumnDef<ThreadUpdate>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              isAllSelected ||
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => {
              if (value) {
                table.toggleAllPageRowsSelected(true)
              } else {
                table.toggleAllPageRowsSelected(false)
                setIsAllSelected(false)
              }
            }}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={isAllSelected || row.getIsSelected()}
            onCheckedChange={(value) => {
              row.toggleSelected(!!value)
              if (!value) setIsAllSelected(false)
            }}
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
        cell: ({ row }) => {
          const status = row.getValue<ThreadUpdate["status"]>("status")
          const traceback = row.original.traceback

          if (status === "error" && traceback) {
            return (
              <div className="flex items-center gap-2">
                <Badge variant={status}>{status}</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setTracebackDialog({ open: true, traceback })
                        }}
                        className="text-destructive hover:text-destructive/80 cursor-pointer"
                        title="View error traceback"
                      >
                        <ChartNoAxesGantt className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      View error traceback
                    </TooltipContent>
                  </Tooltip>
              </div>
            )
          }

          return <Badge variant={status}>{status}</Badge>
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
          return <div className="text-sm">{formatTimestamp(timestamp)}</div>
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
    [isAllSelected]
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
    getRowId: (row) => row.id.toString(),
  })

  // Show "select all" banner when all on page are selected but not all overall
  const showSelectAllBanner =
    table.getIsAllPageRowsSelected() &&
    !isAllSelected &&
    table.getFilteredRowModel().rows.length > 0

  return (
    <div className="space-y-4">
      {showSelectAllBanner && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-900 dark:bg-blue-950">
          <span className="text-blue-900 dark:text-blue-100">
            All {updates.length} updates on this page are selected.
          </span>
          <Button
            variant="link"
            size="sm"
            className="text-blue-700 dark:text-blue-300"
            onClick={() => setIsAllSelected(true)}
          >
            Select all updates across all pages
          </Button>
        </div>
      )}

      {isAllSelected && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-900 dark:bg-blue-950">
          <span className="font-medium text-blue-900 dark:text-blue-100">
            All updates across all pages are selected.
          </span>
          <Button
            variant="link"
            size="sm"
            className="text-blue-700 dark:text-blue-300"
            onClick={() => {
              setIsAllSelected(false)
              table.toggleAllPageRowsSelected(false)
            }}
          >
            Clear selection
          </Button>
        </div>
      )}

      <DataTable
        table={table}
        actionBar={<TableActionBar table={table} isAllSelected={isAllSelected} onAction={handleBulkAction} />}
      >
        <DataTableAdvancedToolbar table={table}>
          <DataTableFilterMenu table={table} />
          <DataTableSortList table={table} />
          <div className="text-sm text-muted-foreground">
            {rowCount} row(s) found
          </div>
        </DataTableAdvancedToolbar>
      </DataTable>
      <DataTablePagination table={table} />

      <Dialog open={tracebackDialog.open} onOpenChange={(open) => setTracebackDialog({ open, traceback: null })}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Error Traceback</DialogTitle>
            <DialogDescription>
              Full stack trace of the error that occurred while processing this update
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap break-words">
              {tracebackDialog.traceback}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
