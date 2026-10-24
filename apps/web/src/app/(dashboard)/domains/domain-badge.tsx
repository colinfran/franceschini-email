import { DomainStatus } from "@prisma/client";
import { cn } from "@usesend/ui";

const statusConfig: Record<DomainStatus, { label: string; dot: string }> = {
  [DomainStatus.SUCCESS]: { label: "Verified", dot: "bg-green" },
  [DomainStatus.PENDING]: { label: "Pending", dot: "bg-yellow" },
  [DomainStatus.TEMPORARY_FAILURE]: {
    label: "Temporary failure",
    dot: "bg-yellow",
  },
  [DomainStatus.FAILED]: { label: "Failed", dot: "bg-red" },
  [DomainStatus.NOT_STARTED]: {
    label: "Not started",
    dot: "bg-muted-foreground",
  },
};

export const DomainStatusBadge: React.FC<{
  status: DomainStatus;
  className?: string;
}> = ({ status, className }) => {
  const config = statusConfig[status] ?? statusConfig.NOT_STARTED;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", config.dot)}
      />
      {config.label}
    </span>
  );
};
