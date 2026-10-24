import { cn } from "@usesend/ui";
import { Mail } from "lucide-react";

export function AppLogo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <Mail className="size-5" />
    </span>
  );
}
