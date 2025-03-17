import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

import { PrismaService } from "../prisma/prisma.service";
import { KubernetesService } from "./kubernetes.service";
import { CreateTenantDto, TenantDto, TenantStatus } from "./tenant.dto";

@Injectable()
export class TenantService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly kubernetesService: KubernetesService,
  ) {}

  async createTenant(
    userId: string,
    data: CreateTenantDto,
  ): Promise<TenantDto> {
    const tenant = await this.prismaService.tenant.create({
      data: {
        name: data.name,
        status: "provisioning",
        User: {
          connect: {
            id: userId,
          },
        },
      },
    });

    // Generate secure credentials
    const postgresPassword = crypto.randomBytes(16).toString("hex");
    const minioAccessKey = crypto.randomBytes(16).toString("hex");
    const minioSecretKey = crypto.randomBytes(32).toString("hex");

    try {
      // Create Kubernetes namespace and resources
      await this.kubernetesService.createTenantNamespace(tenant.id);
      await this.kubernetesService.createTenantResources(tenant.id, {
        postgresPassword,
        minioAccessKey,
        minioSecretKey,
      });

      // Update tenant status
      await this.prismaService.tenant.update({
        where: { id: tenant.id },
        data: {
          status: "running",
          postgresPassword,
          minioAccessKey,
          minioSecretKey,
        },
      });

      return {
        id: tenant.id,
        name: tenant.name,
        status: TenantStatus.READY,
        accessUrl: `https://${tenant.id}.your-domain.com`,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      };
    } catch (error) {
      // Update tenant status to failed
      const updatedTenant = await this.prismaService.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.ERROR },
      });

      // Cleanup Kubernetes resources
      await this.kubernetesService.deleteTenant(tenant.id);

      return {
        id: updatedTenant.id,
        name: updatedTenant.name,
        status: updatedTenant.status as TenantStatus,
        accessUrl: null,
        createdAt: updatedTenant.createdAt,
        updatedAt: updatedTenant.updatedAt,
      };
    }
  }

  async deleteTenant(userId: string, tenantId: string): Promise<void> {
    // Update tenant status to deleting
    await this.prismaService.tenant.updateMany({
      where: { id: tenantId, User: { id: userId } },
      data: { status: TenantStatus.DELETING },
    });

    // Delete Kubernetes resources
    try {
      await this.kubernetesService.deleteTenant(tenantId);
    } catch (error) {
      console.error(
        `Failed to delete Kubernetes resources for tenant ${tenantId}:`,
        error,
      );
    }

    // Delete tenant from database
    await this.prismaService.tenant.delete({
      where: { id: tenantId, User: { id: userId } },
    });
  }

  async listTenants(userId: string): Promise<TenantDto[]> {
    const tenants = await this.prismaService.tenant.findMany({
      where: {
        User: {
          id: userId,
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return tenants.map((tenant) => ({
      ...tenant,
      status: tenant.status as TenantStatus,
      accessUrl:
        tenant.status === TenantStatus.READY
          ? `https://${tenant.id}.your-domain.com`
          : null,
    }));
  }
}
