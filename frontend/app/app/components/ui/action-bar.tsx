import * as React from "react"
import { X } from "lucide-react"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"

interface ActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActionBar({
  open,
  onOpenChange,
  children,
  className,
  ...props
}: ActionBarProps) {
  return (
    <div
      data-state={open ? "open" : "closed"}
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transition-all duration-200",
        "data-[state=closed]:pointer-events-none data-[state=closed]:translate-y-16 data-[state=closed]:opacity-0",
        "data-[state=open]:translate-y-0 data-[state=open]:opacity-100",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg">
        {children}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
    </div>
  )
}
