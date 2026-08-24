import { requireAnyPermission } from './guard';
import type { Permission } from '../enums';

export async function requireAdmin(permissions?: readonly Permission[]): Promise<{ staffId: string; permissions: string[] }> {
  if (permissions && permissions.length > 0) {
    return requireAnyPermission(permissions);
  }
  return requireAnyPermission(['settings.read']);
}