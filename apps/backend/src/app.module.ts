import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import environment from "./config/environment";
import { TenantModule } from "./tenant/tenant.module";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [environment]
    })
  ],
  controllers: [],
  providers: []
})
export class AppModule {
}
