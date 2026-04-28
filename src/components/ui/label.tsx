import * as React from "react"
import { cn } from "@/src/lib/utils"

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-[10px] font-bold uppercase tracking-widest text-green-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 block mb-1.5", className)}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }
