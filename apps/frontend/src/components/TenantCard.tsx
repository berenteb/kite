import { formatDistanceToNow } from "date-fns";
import { CopyIcon, ExternalLink, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { TenantDto, TenantDtoStatusEnum } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDeleteTenant } from "@/hooks/use-tenant";

import { TenantComponentListItem } from "./TenantComponentListItem";

interface TenantCardProps {
  tenant: TenantDto;
}

export function TenantCard({ tenant }: TenantCardProps) {
  const deleteTenant = useDeleteTenant();
  const [showSecrets, setShowSecrets] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    await deleteTenant.mutateAsync(tenant.id);
    toast.success("Tenant deleted successfully");
  };

  const handleRestart = async () => {};

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="font-bold text-lg">{tenant.name}</CardTitle>
              <CardDescription className="text-sm mt-1">
                ID: {tenant.id}
              </CardDescription>
            </div>
            <StatusBadge status={tenant.status} />
          </div>
        </CardHeader>
        <CardContent className="pb-2 space-y-4">
          {tenant.accessUrl && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Access URL</div>
              <div className="flex items-center space-x-2">
                <code className="bg-secondary p-1.5 px-2 rounded text-xs flex-1 overflow-hidden overflow-ellipsis">
                  {tenant.accessUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => window.open(tenant.accessUrl, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="sr-only">Open</span>
                </Button>
              </div>
            </div>
          )}

          {tenant.secrets && tenant.secrets.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Secrets</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setShowSecrets(!showSecrets)}
                >
                  {showSecrets ? "Hide" : "Show"}
                </Button>
              </div>
              {showSecrets && (
                <div className="space-y-2">
                  {tenant.secrets.map((secret) => (
                    <div key={secret.key} className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {secret.key}
                      </div>
                      <div className="flex items-center space-x-2">
                        <code className="bg-secondary p-1.5 px-2 rounded text-xs flex-1 overflow-hidden overflow-ellipsis">
                          {secret.value}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            copyToClipboard(secret.value, secret.key)
                          }
                        >
                          <CopyIcon />
                          <span className="sr-only">Copy</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tenant.componentStatuses.length > 0 && (
            <div className="space-y-2 border-t dark:border-gray-700 border-gray-300 pt-4">
              {tenant.componentStatuses.map((component) => (
                <TenantComponentListItem
                  key={component.name}
                  component={component}
                />
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(tenant.createdAt))} ago
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestart}
              disabled={
                deleteTenant.isPending ||
                tenant.status === TenantDtoStatusEnum.Provisioning
              }
            >
              <RotateCw className="h-3.5 w-3.5 mr-1" />
              Restart
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={deleteTenant.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tenant "{tenant.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteTenant.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTenant.isPending}
            >
              {deleteTenant.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
