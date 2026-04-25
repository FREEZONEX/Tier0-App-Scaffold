import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted",
        "bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--muted)_0%,oklch(0.94_0_0)_50%,var(--muted)_100%)]",
        "[animation:shimmer_1.5s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
