import 'dotenv/config';
import {
  PrismaClient as AccountsPrismaClient,
  StaffRole,
} from '../apps/accounts-service/prisma/generated/client';
import { PrismaClient as ProviderPrismaClient } from '../apps/provider-directory-service/prisma/generated/client';

type DoctorRecord = {
  id: string;
  staffAccountId: string;
  createdAt: Date;
  updatedAt: Date;
};

type AccountStatus = {
  id: string;
  role: StaffRole;
  deletedAt: Date | null;
};

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const verbose = args.includes('--verbose');

const accountsPrisma = new AccountsPrismaClient({
  log: verbose ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});
const providerPrisma = new ProviderPrismaClient({
  log: verbose ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

async function findOrphanDoctors(): Promise<DoctorRecord[]> {
  const doctors = await providerPrisma.doctor.findMany({
    select: {
      id: true,
      staffAccountId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (doctors.length === 0) {
    return [];
  }

  const staffAccountIds = Array.from(
    new Set(doctors.map((doctor) => doctor.staffAccountId)),
  );

  const accounts = await accountsPrisma.staffAccount.findMany({
    where: { id: { in: staffAccountIds } },
    select: { id: true, role: true, deletedAt: true },
  });

  const accountMap = new Map<string, AccountStatus>();
  accounts.forEach((account) =>
    accountMap.set(account.id, {
      id: account.id,
      role: account.role,
      deletedAt: account.deletedAt,
    }),
  );

  return doctors.filter((doctor) => {
    const account = accountMap.get(doctor.staffAccountId);
    if (!account) return true;
    if (account.role !== StaffRole.DOCTOR) return true;
    return account.deletedAt !== null;
  });
}

async function deleteOrphanDoctors(
  orphanDoctors: DoctorRecord[],
): Promise<void> {
  if (orphanDoctors.length === 0) return;
  const deletions = orphanDoctors.map((doctor) =>
    providerPrisma.doctor.delete({
      where: { id: doctor.id },
    }),
  );

  await providerPrisma.$transaction(deletions);
}

async function main(): Promise<void> {
  console.log('=== Doctor Profile Cleanup ===');
  console.log(`Mode: ${execute ? 'execute' : 'dry-run'}`);
  console.log('');

  try {
    const orphanDoctors = await findOrphanDoctors();

    if (orphanDoctors.length === 0) {
      console.log('No orphan doctor profiles detected. Nothing to do.');
      return;
    }

    console.log(
      `Found ${orphanDoctors.length} orphan doctor profile(s) referencing deleted or missing accounts.`,
    );

    if (!execute) {
      orphanDoctors.forEach((doctor) =>
        console.log(
          `- doctorId=${doctor.id} staffAccountId=${doctor.staffAccountId} updatedAt=${doctor.updatedAt.toISOString()}`,
        ),
      );
      console.log('');
      console.log(
        'Run again with --execute to remove these profiles from provider-directory-service.',
      );
      return;
    }

    await deleteOrphanDoctors(orphanDoctors);

    console.log(
      `Removed ${orphanDoctors.length} orphan doctor profile(s) from provider-directory-service.`,
    );
  } catch (error) {
    console.error(
      'Cleanup failed:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await Promise.all([
      accountsPrisma.$disconnect(),
      providerPrisma.$disconnect(),
    ]);
  }
}

void main();
