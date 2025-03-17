import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

import { Environment } from "../../config/environment";
import { AuthService } from "../auth.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => this.extractJwtTokenFromCookie(request)
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<Environment["jwtSecret"]>("jwtSecret")
    });
  }

  async validate(payload: { sub: string; email: string }) {
    try {
      return await this.authService.validateUser(payload.sub);
    } catch (error) {
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractJwtTokenFromCookie(req: Request): string {
    const jwtCookie = req.cookies["jwt"];
    if (!jwtCookie) {
      throw new UnauthorizedException();
    }
    return jwtCookie;
  }
}
