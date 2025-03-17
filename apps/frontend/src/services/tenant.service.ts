import { CreateTenantDto, TenantsApi } from "@/api";
import { setupApi } from "@/lib/api.utils";

const tenantApi = setupApi(TenantsApi);

export async function createTenant(tenant: CreateTenantDto) {
  const response = await tenantApi.tenantControllerCreateTenant(tenant);
  return response.data;
}

export async function deleteTenant(id: string) {
  const response = await tenantApi.tenantControllerDeleteTenant(id);
  return response.data;
}

export async function getTenants() {
  const response = await tenantApi.tenantControllerListTenants();
  return response.data;
}
