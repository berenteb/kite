import { Plus } from "lucide-react";
import { useState } from "react";

import { CreateTenantDialog } from "@/components/CreateTenantDialog";
import { TenantList } from "@/components/TenantList";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tenant instances
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Tenant
        </Button>
      </div>

      <TenantList />

      <CreateTenantDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
