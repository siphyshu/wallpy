import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Button = forwardRef(({ 
  className, 
  variant = "default", 
  size = "default", 
  disabled = false,
  asChild = false,
  children,
  ...props 
}, ref) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50"
  
  const variants = {
    default: "bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm",
    destructive: "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 backdrop-blur-sm",
    outline: "border border-white/20 text-white hover:bg-white/10 backdrop-blur-sm",
    secondary: "bg-white/5 text-white hover:bg-white/10 border border-white/10 backdrop-blur-sm",
    ghost: "text-white hover:bg-white/10",
    link: "text-white underline-offset-4 hover:underline"
  }
  
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  }
  
  const Comp = asChild ? 'span' : 'button'
  
  return (
    <Comp
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        className
      )}
      ref={ref}
      disabled={disabled}
      {...props}
    >
      {children}
    </Comp>
  )
})

Button.displayName = "Button"

export { Button } 