import { logoutStaff } from '@/lib/auth/session';
import { apiError, apiOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await logoutStaff();
    return apiOk({ success: true });
  } catch (error) {
    console.error('Staff logout failed:', error);
    return apiError('INTERNAL_ERROR', 'Unable to sign out. Please try again.', 500);
  }
}
