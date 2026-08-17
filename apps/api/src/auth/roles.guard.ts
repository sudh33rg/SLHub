import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from './roles';

/**
 * Enforces role-based access control. Reads the request user populated by AuthGuard
 * (JWT sub/role) and compares it against the @Roles() metadata on the handler/controller.
 * No @Roles() metadata => any authenticated user is allowed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    if (!required.includes(user.role)) throw new ForbiddenException(`Requires role: ${required.join(', ')}`);
    return true;
  }
}
