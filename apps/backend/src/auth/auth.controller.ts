import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Response } from "express";

import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto, RegisterDto, UserDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LocalAuthGuard } from "./guards/local-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
  }

  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: 201,
    description: "User registered successfully"
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Res() res: Response
  ): Promise<void> {
    const response = await this.authService.register(registerDto);
    const token = this.authService.generateToken(response.user);
    this.setCookie(res, token);
    res.send(response.user);
  }

  @Post("login")
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({
    status: 200,
    description: "User logged in successfully"
  })
  @UseGuards(LocalAuthGuard)
  async login(
    @Body() _: LoginDto,
    @Res() res: Response,
    @CurrentUser() user: UserDto
  ): Promise<void> {
    const token = this.authService.generateToken(user);
    this.setCookie(res, token);
    res.send(user);
  }

  @Post("logout")
  @ApiOperation({ summary: "Logout the current user" })
  @ApiResponse({
    status: 200,
    description: "User logged out successfully"
  })
  @UseGuards(JwtAuthGuard)
  async logout(@Res() res: Response): Promise<void> {
    this.clearCookie(res);
    res.send();
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user information" })
  @ApiResponse({
    status: 200,
    description: "Current user information",
    type: UserDto
  })
  async getCurrentUser(@CurrentUser() user: UserDto): Promise<UserDto> {
    return user;
  }

  private setCookie(res: Response, token: string) {
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: true,
      domain: this.configService.get("cookieDomain"),
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    });
  }

  private clearCookie(res: Response) {
    res.clearCookie("jwt", {
      domain: this.configService.get("cookieDomain")
    });
  }

  private redirect(res: Response, returnTo?: string) {
    const frontendUrl = this.configService.get("frontendUrl");
    if (!frontendUrl) {
      throw new Error("Frontend URL is not set");
    }
    const url = new URL(frontendUrl);
    const decodedReturnTo = returnTo ? decodeURIComponent(returnTo) : "";
    if (decodedReturnTo && this.isValidRedirectUrl(decodedReturnTo)) {
      url.pathname = decodedReturnTo;
    }
    res.redirect(url.toString());
  }

  private isValidRedirectUrl(path: string): boolean {
    const regex = /^(\/[A-Za-z0-9-_]+)*\/?$/;
    return regex.test(path);
  }
}
