import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTenant,
  deleteTenant,
  getTenants,
} from "@/services/tenant.service";

export const tenantKeys = {
  all: ["tenants"] as const,
  lists: () => [...tenantKeys.all, "list"] as const,
};

export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.lists() });
    },
  });
};

export const useDeleteTenant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.lists() });
    },
  });
};

export const useTenants = () => {
  return useQuery({
    queryKey: tenantKeys.lists(),
    queryFn: getTenants,
    refetchInterval: 5000,
  });
};
