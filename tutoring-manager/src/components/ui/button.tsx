"use client";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/client";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
  {
    variants: {
      variant: {
        primary: "bg-primary-strong text-white shadow-sm hover:bg-primary-strong/90 dark:text-navy",
        secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        soft: "bg-primary-soft text-primary-strong hover:bg-primary-soft/70",
        accent: "bg-accent-soft text-ink hover:bg-accent-soft/80",
        success: "bg-success text-white hover:bg-success/90 dark:text-navy",
        danger: "bg-danger text-white hover:bg-danger/90 dark:text-navy",
        "danger-ghost": "text-danger hover:bg-danger-soft",
      },
      size: { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-[15px]", icon: "h-9 w-9", "icon-sm": "h-8 w-8" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, loading, children, ...props }, ref) {
  return (
    <button ref={ref} type={props.type ?? "button"} {...props} disabled={props.disabled || loading} className={cn(buttonVariants({ variant, size }), className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
