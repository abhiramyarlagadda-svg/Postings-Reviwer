import * as React from "react"
import { cn } from "@/src/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'dashed'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
          variant === 'default' && "bg-green-700 text-white hover:bg-green-800 border-2 border-transparent",
          variant === 'outline' && "border-2 border-green-700 text-green-700 bg-transparent hover:bg-green-700 hover:text-white",
          variant === 'dashed' && "border-2 border-dashed border-green-300 text-green-600 font-medium hover:bg-green-50",
          variant === 'ghost' && "hover:bg-green-100 text-green-700",
          variant === 'secondary' && "bg-green-100 text-green-700 hover:bg-green-200 border-2 border-transparent",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
