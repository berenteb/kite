import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateTenantDto {
  @ApiProperty({
    description: "The name of the tenant",
    example: "My Service",
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export enum TenantStatus {
  PROVISIONING = "provisioning",
  READY = "ready",
  ERROR = "error",
  DELETING = "deleting",
}

export class TenantSecretDto {
  @ApiProperty({
    description: "The key of the secret",
    example: "postgres-password",
  })
  key: string;

  @ApiProperty({
    description: "The value of the secret",
    example: "postgres",
  })
  value: string;
}

export enum ComponentStatus {
  RUNNING = "running",
  PENDING = "pending",
  UNHEALTHY = "unhealthy",
  ERROR = "error",
  UNAVAILABLE = "unavailable",
  UNKNOWN = "unknown",
}
export class TenantComponentStatusDto {
  @ApiProperty({
    description: "The name of the component",
    example: "postgres",
  })
  name: string;

  @ApiProperty({
    description: "The status of the component",
    example: "running",
    enum: ComponentStatus,
  })
  status: ComponentStatus;

  @ApiProperty({
    description: "The message of the component",
    example: "The component is running",
    nullable: true,
    type: String,
  })
  message: string | null;
}

export class TenantDto {
  @ApiProperty({
    description: "The ID of the tenant",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "The name of the tenant",
    example: "My Service",
  })
  name: string;

  @ApiProperty({
    description: "The status of the tenant",
    example: "provisioning",
    enum: TenantStatus,
  })
  status: TenantStatus;

  @ApiProperty({
    description: "The access URL of the tenant",
    example: "https://my-service.kite.internal",
    nullable: true,
    type: String,
  })
  accessUrl: string | null;

  @ApiProperty({
    description: "The creation date of the tenant",
    example: "2021-01-01T00:00:00.000Z",
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: "The update date of the tenant",
    example: "2021-01-01T00:00:00.000Z",
    type: Date,
  })
  updatedAt: Date;

  @ApiProperty({
    description: "The secrets of the tenant",
    type: [TenantSecretDto],
  })
  secrets: TenantSecretDto[];

  @ApiProperty({
    description: "The component statuses of the tenant",
    type: TenantComponentStatusDto,
    isArray: true,
  })
  componentStatuses: TenantComponentStatusDto[];
}
