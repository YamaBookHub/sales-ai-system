import { PrismaClient } from '@prisma/client';
import { bootstrapAdmin, readBootstrapAdminConfig } from '../apps/api/src/auth/bootstrap-admin';

const prisma = new PrismaClient();

bootstrapAdmin(prisma, readBootstrapAdminConfig())
  .then((result) => {
    if (result.status === 'disabled') {
      console.log('Admin bootstrap is disabled. No changes were made.');
      return;
    }
    console.log(`Admin bootstrap ${result.status}: ${result.user?.email}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
