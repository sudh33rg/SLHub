import { SetMetadata } from '@nestjs/common';

export type Role = 'admin' | 'operator' | 'viewer';

/**
 * Roles allowed to activate a route. Used together with RolesGuard.
 * Routes without @Roles() are open to any authenticated user.
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
