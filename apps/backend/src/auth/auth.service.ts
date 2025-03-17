import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { Environment } from "../config/environment";
import { PrismaService } from "../prisma/prisma.service";
import { AuthResponseDto, LoginDto, RegisterDto, UserDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prismaService.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(password);

    // Create the user
    const user = await this.prismaService.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: hashedPassword
      }
    });

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: this.mapToUserDto(user),
      token
    };
  }

  async login(loginDto: LoginDto): Promise<UserDto> {
    const { email, password } = loginDto;

    const user = await this.prismaService.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await this.verifyPassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.mapToUserDto(user);
  }

  async validateUser(userId: string): Promise<UserDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return this.mapToUserDto(user);
  }

  generateToken(user: { id: string; email: string }): string {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = this.configService.get<Environment["salt"]>("salt");
    return bcrypt.hash(password, salt ?? 5);
  }

  private async verifyPassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private mapToUserDto(user: User): UserDto {
    const { id, email, firstName, lastName, createdAt } = user;
    return { id, email, firstName, lastName, createdAt };
  }
}
