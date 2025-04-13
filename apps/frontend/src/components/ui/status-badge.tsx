import { TenantDtoStatusEnum } from "@/api";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: TenantDtoStatusEnum;
  className?: string;
}

const statusConfig = {
  [TenantDtoStatusEnum.Ready]: {
    bg: "bg-green-500/20",
    text: "text-green-500",
    label: "Active",
  },
  [TenantDtoStatusEnum.Provisioning]: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-500",
    label: "Provisioning",
  },
  [TenantDtoStatusEnum.Error]: {
    bg: "bg-red-500/20",
    text: "text-red-500",
    label: "Error",
  },
  [TenantDtoStatusEnum.Deleting]: {
    bg: "bg-gray-500/20",
    text: "text-gray-500",
    label: "Deleting",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
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
      {config.label}
    </div>
  );
}
