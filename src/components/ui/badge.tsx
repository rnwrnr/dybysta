import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12.5px] font-medium whitespace-nowrap [&>svg]:size-3 shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground/80",
        soft: "border-transparent bg-accent text-accent-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        warning: "border-transparent bg-warning/15 text-[oklch(0.5_0.13_60)]",
        success: "border-transparent bg-success/12 text-[oklch(0.45_0.12_155)]",
      },
    },
    defaultVariants: { variant: "secondary" },
  }
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
