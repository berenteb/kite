import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({
    description: "User's email address",
    example: "user@example.com"
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "User's first name",
    example: "John"
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: "User's last name",
    example: "Doe"
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: "User's password",
    example: "password123"
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginDto {
  @ApiProperty({
    description: "User's email address",
    example: "user@example.com"
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: "User's password",
    example: "password123"
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UserDto {
  @ApiProperty({
    description: "User's ID",
    example: "123e4567-e89b-12d3-a456-426614174000"
  })
  id: string;

  @ApiProperty({
    description: "User's email address",
    example: "user@example.com"
  })
  email: string;

  @ApiProperty({
    description: "User's first name",
    example: "John"
  })
  firstName: string;

  @ApiProperty({
    description: "User's last name",
    example: "Doe"
  })
  lastName: string;

  @ApiProperty({
    description: "User's creation date",
    example: "2021-01-01T00:00:00.000Z"
  })
  createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    description: "User information"
  })
  user: UserDto;

  @ApiProperty({
    description: "JWT token for authentication",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  })
  token: string;
}
