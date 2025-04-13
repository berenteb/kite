import { TenantComponentStatusDtoStatusEnum } from "@/api";
import { cn } from "@/lib/utils";

interface ComponentStatusBadgeProps {
  status: TenantComponentStatusDtoStatusEnum;
  className?: string;
}

const statusConfig = {
  [TenantComponentStatusDtoStatusEnum.Running]: {
    bg: "bg-green-500/20",
    text: "text-green-500",
    label: "Running",
  },
  [TenantComponentStatusDtoStatusEnum.Pending]: {
    bg: "bg-blue-500/20",
    text: "text-blue-500",
    label: "Pending",
  },
  [TenantComponentStatusDtoStatusEnum.Error]: {
    bg: "bg-red-500/20",
    text: "text-red-500",
    label: "Error",
  },
  [TenantComponentStatusDtoStatusEnum.Unhealthy]: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-500",
    label: "Unhealthy",
  },
  [TenantComponentStatusDtoStatusEnum.Unavailable]: {
    bg: "bg-slate-500/20",
    text: "text-slate-500",
    label: "Unavailable",
  },
  [TenantComponentStatusDtoStatusEnum.Unknown]: {
    bg: "bg-gray-500/20",
    text: "text-gray-500",
    label: "Unknown",
  },
};

export function ComponentStatusBadge({
  status,
  className,
}: ComponentStatusBadgeProps) {
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
