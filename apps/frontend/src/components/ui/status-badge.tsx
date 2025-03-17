import { TenantDtoStatusEnum } from "@/api";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: TenantDtoStatusEnum;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    [TenantDtoStatusEnum.Ready]: {
      bg: "bg-status-active/20",
      text: "text-status-active",
      label: "Active",
    },
    [TenantDtoStatusEnum.Provisioning]: {
      bg: "bg-status-pending/20",
      text: "text-status-pending",
      label: "Provisioning",
    },
    [TenantDtoStatusEnum.Error]: {
      bg: "bg-status-error/20",
      text: "text-status-error",
      label: "Error",
    },
    [TenantDtoStatusEnum.Deleting]: {
      bg: "bg-status-inactive/20",
      text: "text-status-inactive",
      label: "Deleting",
    },
  };

  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.bg,
        config.text,
        className,
      )}
    >
      <span
        className="rounded-full"
        style={{ backgroundColor: `var(--status-${status})` }}
      />
      {config.label}
    </div>
  );
}
