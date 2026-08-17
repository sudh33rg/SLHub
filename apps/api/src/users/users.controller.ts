import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles';
import { Role } from '../auth/user.entity';
import { UsersService } from './users.service';

class CreateUserDto {
  @IsString() @MinLength(3) username!: string;
  @IsString() @MinLength(6) password!: string;
  @IsIn(['admin', 'operator', 'viewer']) role!: Role;
  @IsOptional() @IsString() ownerName?: string;
}

class UpdateUserDto {
  @IsOptional() @IsIn(['admin', 'operator', 'viewer']) role?: Role;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(6) password?: string;
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private s: UsersService) {}

  @Get() list(@Request() req: any) {
    return this.s.list(req.user.role);
  }

  @Post() create(@Request() req: any, @Body() d: CreateUserDto) {
    return this.s.create(req.user.role, d.username, d.password, d.role, d.ownerName);
  }

  @Patch(':id') update(@Request() req: any, @Param('id') id: string, @Body() d: UpdateUserDto) {
    return this.s.update(req.user.role, +id, d);
  }

  @Delete(':id') remove(@Request() req: any, @Param('id') id: string) {
    return this.s.remove(req.user.role, +id);
  }
}
