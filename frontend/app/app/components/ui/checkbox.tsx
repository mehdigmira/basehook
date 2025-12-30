import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "~/lib/utils"

const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "checked"> & {
    checked?: boolean | "indeterminate"
    onCheckedChange?: (checked: boolean) => void
  }
>(({ className, checked, onCheckedChange, ...props }, ref) => {
  const isIndeterminate = checked === "indeterminate"
  const isChecked = checked === true

  return (
    <div className="relative flex items-center">
      <input
        type="checkbox"
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary bg-background appearance-none cursor-pointer",
          "checked:bg-primary checked:border-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        checked={isChecked}
        data-state={isIndeterminate ? "indeterminate" : isChecked ? "checked" : "unchecked"}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...props}
      />
      <Check className="absolute h-4 w-4 pointer-events-none text-primary-foreground hidden peer-checked:block peer-data-[state=indeterminate]:block" />
    </div>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
