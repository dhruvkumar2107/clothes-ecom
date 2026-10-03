import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../src/lib/enums';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Store Administrator';

  if (!email || !password) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before running this command.');
  }
  if (Buffer.byteLength(password, 'utf8') < 16 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be 16 to 72 bytes long.');
  }

  const passwordHash = await hashPassword(password);
  const permissionsCsv = PERMISSIONS.join(',');

  await prisma.$transaction(async (tx) => {
    if (await tx.staffUser.count() > 0) {
      throw new Error('Staff accounts already exist. Use the existing admin account or staff-management flow.');
    }

    const role = await tx.staffRole.upsert({
      where: { slug: 'admin' },
      update: { permissionsCsv, isSystem: true },
      create: {
        name: 'Administrator',
        slug: 'admin',
        description: 'Full system access',
        permissionsCsv,
        isSystem: true,
      },
      select: { id: true },
    });

    await tx.staffUser.create({
      data: {
        email,
        passwordHash,
        name,
        roleId: role.id,
        status: 'active',
      },
    });
  }, { maxWait: 10_000, timeout: 30_000 });

  console.log(`Created the initial administrator account for ${email}.`);
}

bootstrapAdmin()
  .catch((error: unknown) => {
    console.error('Admin bootstrap failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
