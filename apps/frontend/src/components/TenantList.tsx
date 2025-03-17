import { useTenants } from "@/hooks/use-tenant";

import { TenantCard } from "./TenantCard";
import { LoadingSpinner } from "./ui/loading-spinner";

export function TenantList() {
  const { data: tenants, isLoading } = useTenants();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-lg">
        <h3 className="text-lg font-medium mb-2">No tenants yet</h3>
        <p className="text-muted-foreground">
          Create your first tenant to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tenants.map((tenant) => (
        <TenantCard key={tenant.id} tenant={tenant} />
      ))}
    </div>
  );
}
