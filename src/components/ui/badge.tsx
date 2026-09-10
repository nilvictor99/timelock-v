import { cn } from "@/lib/utils";

export function Badge({ className, children, variant = "default" }: { className?: string; children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variant === "default" && "bg-muted text-muted-foreground", variant === "success" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300", variant === "warning" && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", variant === "danger" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", className)}>{children}</span>;
}
