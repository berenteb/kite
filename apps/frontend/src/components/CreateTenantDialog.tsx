import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCreateTenant } from "@/hooks/use-tenant";

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createTenantSchema = z.object({
  name: z.string().min(1, { message: "Tenant name is required" }),
});

type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

export function CreateTenantDialog({
  open,
  onOpenChange,
}: CreateTenantDialogProps) {
  const createTenantMutation = useCreateTenant();

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (values: CreateTenantFormValues) => {
    try {
      await createTenantMutation.mutateAsync({ name: values.name.trim() });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create tenant:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Enter a name for your new tenant. The system will automatically
                provision resources.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="col-span-3"
                        placeholder="My Tenant"
                        disabled={createTenantMutation.isPending}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage className="col-span-3 col-start-2" />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  createTenantMutation.isPending || !form.formState.isValid
                }
              >
                {createTenantMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Tenant"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
