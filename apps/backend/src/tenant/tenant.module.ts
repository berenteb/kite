import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "src/prisma/prisma.module";

import { KubernetesService } from "./kubernetes.service";
import { TenantController } from "./tenant.controller";
import { TenantService } from "./tenant.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TenantController],
  providers: [TenantService, KubernetesService],
  exports: [TenantService]
})
export class TenantModule {
}
