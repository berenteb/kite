import { TenantComponentStatusDto } from "@/api";

import { ComponentStatusBadge } from "./ui/component-status-badge";

interface TenantComponentListItemProps {
  component: TenantComponentStatusDto;
}

export function TenantComponentListItem({
  component,
}: TenantComponentListItemProps) {
  return (
    <div className="p-2 bg-gray-800 rounded-md">
      <div className="flex items-center gap-2 justify-between w-full">
        <span className="capitalize">{component.name}</span>
        <ComponentStatusBadge status={component.status} />
      </div>
      {component.message && (
        <div className="text-xs text-muted-foreground border-t border-gray-700 mt-2 pt-2">
          <p className="line-clamp-2">{component.message}</p>
        </div>
      )}
    </div>
  );
}
