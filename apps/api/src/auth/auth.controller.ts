import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles';
import { Role } from './user.entity';

class LoginDto {
  @IsString() username!: string;
  @IsString() @MinLength(4) password!: string;
}

class ChangePasswordDto {
  @IsString() @MinLength(6) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private s: AuthService) {}

  @Post('login') login(@Body() d: LoginDto) {
    return this.s.login(d.username, d.password);
  }

  @UseGuards(AuthGuard) @Get('me') me(@Request() req: any) {
    return this.s.me(req.user.sub);
  }

  @UseGuards(AuthGuard) @Post('me/password') changePassword(@Request() req: any, @Body() d: ChangePasswordDto) {
    return this.s.changePassword(req.user.sub, d.password);
  }
}
