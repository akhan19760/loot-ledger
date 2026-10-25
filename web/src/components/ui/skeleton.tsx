import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("sweep chamfer bg-surface", className)}
      {...props}
    />
  )
}

export { Skeleton }
