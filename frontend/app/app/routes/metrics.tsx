import { useState, useEffect } from "react"
import type { Route } from "./+types/metrics"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { RefreshCw } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Metrics - Basehook" },
    { name: "description", content: "View analytics and performance metrics" },
  ]
}

interface MetricDataPoint {
  timestamp: number
  date: string
  pending: number
  success: number
  error: number
  skipped: number
}

const chartConfig = {
  pending: {
    label: "Pending",
    color: "#f0b100",
  },
  success: {
    label: "Success",
    color: "#00c951",
  },
  error: {
    label: "Error",
    color: "#fb2c36",
  },
  skipped: {
    label: "Skipped",
    color: "#6a7282",
  },
}

export default function Metrics() {
  const [data, setData] = useState<MetricDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState("24h")

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/metrics?range=${timeRange}`)
      if (!response.ok) {
        throw new Error("Failed to fetch metrics")
      }
      const result = await response.json()
      setData(result.data || [])
    } catch (error) {
      console.error("Failed to fetch metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [timeRange])

  const formatXAxis = (value: string) => {
    // Parse the date string "YYYY-MM-DD HH:MM:SS"
    const date = new Date(value)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      // Today: show time only
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else if (diffDays < 7) {
      // This week: show day and time
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } else {
      // Older: show date
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
            <p className="text-muted-foreground">
              Cumulative thread updates by status over time
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
              onClick={fetchMetrics}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Total Pending
            </div>
            <div className="mt-2 text-2xl font-bold" style={{ color: chartConfig.pending.color }}>
              {data.length > 0 ? data[data.length - 1].pending : 0}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Total Success
            </div>
            <div className="mt-2 text-2xl font-bold" style={{ color: chartConfig.success.color }}>
              {data.length > 0 ? data[data.length - 1].success : 0}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Total Error
            </div>
            <div className="mt-2 text-2xl font-bold" style={{ color: chartConfig.error.color }}>
              {data.length > 0 ? data[data.length - 1].error : 0}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-muted-foreground">
              Total Skipped
            </div>
            <div className="mt-2 text-2xl font-bold" style={{ color: chartConfig.skipped.color }}>
              {data.length > 0 ? data[data.length - 1].skipped : 0}
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-6">
          {data.length === 0 ? (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
              {loading ? "Loading metrics..." : "No data available"}
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[500px] w-full">
              <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  textAnchor="end"
                  height={100}
                  interval={Math.max(0, Math.floor(data.length / 10) - 1)}
                  tickFormatter={formatXAxis}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="pending"
                  stroke={chartConfig.pending.color}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="success"
                  stroke={chartConfig.success.color}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="error"
                  stroke={chartConfig.error.color}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="skipped"
                  stroke={chartConfig.skipped.color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </div>
  )
}
