import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // DS 2.0: Default = Soft Badge (옅은 배경 + 진한 글자)
        default:
          "border-transparent bg-neutral-100 text-neutral-900 [a&]:hover:bg-neutral-200",
        secondary:
          "border-transparent bg-neutral-100 text-neutral-700 [a&]:hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300",
        destructive:
          "border-transparent bg-red-50 text-red-700 [a&]:hover:bg-red-100 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-red-950 dark:text-red-400",
        outline:
          "border-neutral-200 text-neutral-700 [a&]:hover:bg-neutral-100 [a&]:hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300",
        // DS 2.0: Semantic colors (최소 면적)
        success: "border-transparent bg-emerald-50 text-emerald-700 [a&]:hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400",
        warning: "border-transparent bg-amber-50 text-amber-700 [a&]:hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
