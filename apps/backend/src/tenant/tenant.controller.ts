import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { User } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateTenantDto, TenantDto } from "./tenant.dto";
import { TenantService } from "./tenant.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: "Create a new tenant" })
  @ApiResponse({
    status: 201,
    description: "Tenant created successfully",
    type: TenantDto,
  })
  async createTenant(@CurrentUser() user: User, @Body() data: CreateTenantDto) {
    return this.tenantService.createTenant(user.id, data);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a tenant" })
  @ApiResponse({ status: 200, description: "Tenant deleted successfully" })
  async deleteTenant(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tenantService.deleteTenant(user.id, id);
  }

  @Get()
  @ApiOperation({ summary: "List all tenants" })
  @ApiResponse({
    status: 200,
    description: "List of tenants",
    type: [TenantDto],
  })
  async listTenants(@CurrentUser() user: User) {
    return this.tenantService.listTenants(user.id);
  }
}
