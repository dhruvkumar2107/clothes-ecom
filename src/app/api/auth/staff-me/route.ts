import { getStaffSession } from '@/lib/auth/session';
import { apiError, apiOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getStaffSession();
    if (!session) return apiError('UNAUTHORIZED', 'Please sign in to the admin panel.', 401);

    return apiOk({
      staff: {
        id: session.staffId,
        name: session.name,
        email: session.email,
        photoUrl: session.photoUrl,
        roleName: session.roleName,
      },
    });
  } catch (error) {
    console.error('Staff session lookup failed:', error);
    return apiError('INTERNAL_ERROR', 'Unable to load the staff profile.', 500);
  }
}
