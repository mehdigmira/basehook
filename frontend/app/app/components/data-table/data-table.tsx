import type { Table as TanstackTable, ColumnSort } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

export type ExtendedColumnSort<TData> = ColumnSort
export type ExtendedColumnFilter<TData> = {
  id: string
  value: string | string[]
}

export type QueryKeys = {
  page: string
  perPage: string
  sort: string
  filters: string
  joinOperator: string
}

export const dataTableConfig = {
  filterVariants: [
    "text",
    "number",
    "range",
    "date",
    "dateRange",
    "boolean",
    "select",
    "multiSelect",
  ] as const,
  operators: [
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "iLike",
    "notLike",
    "notILike",
    "in",
    "notIn",
    "between",
    "isEmpty",
    "isNotEmpty",
  ] as const,
  textOperators: [
    { label: "Contains", value: "iLike" as const },
    { label: "Does not contain", value: "notILike" as const },
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
  ],
  numericOperators: [
    { label: "Equal to", value: "eq" as const },
    { label: "Not equal to", value: "ne" as const },
    { label: "Greater than", value: "gt" as const },
    { label: "Greater than or equal to", value: "gte" as const },
    { label: "Less than", value: "lt" as const },
    { label: "Less than or equal to", value: "lte" as const },
  ],
  dateOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
    { label: "After", value: "gt" as const },
    { label: "On or after", value: "gte" as const },
    { label: "Before", value: "lt" as const },
    { label: "On or before", value: "lte" as const },
  ],
  booleanOperators: [{ label: "Is", value: "eq" as const }],
  selectOperators: [
    { label: "Is", value: "eq" as const },
    { label: "Is not", value: "ne" as const },
  ],
  multiSelectOperators: [
    { label: "Is any of", value: "in" as const },
    { label: "Is none of", value: "notIn" as const },
  ],
}

interface DataTableProps<TData> extends React.HTMLAttributes<HTMLDivElement> {
  table: TanstackTable<TData>
  actionBar?: React.ReactNode
}

export function DataTable<TData>({
  table,
  children,
  actionBar,
  ...props
}: DataTableProps<TData>) {
  return (
    <div className="w-full space-y-2.5 overflow-auto" {...props}>
      {children}
      {actionBar}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
