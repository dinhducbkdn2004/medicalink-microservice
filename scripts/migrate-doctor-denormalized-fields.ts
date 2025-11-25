/**
 * Migration script to sync denormalized fields between accounts and doctors
 */
import { PrismaClient as AccountsPrisma } from '../apps/accounts-service/prisma/generated/client';
import { PrismaClient as ProviderPrisma } from '../apps/provider-directory-service/prisma/generated/client';
import { config } from 'dotenv';
import { Logger } from '@nestjs/common';

config({ path: '.env' });

interface MigrationStats {
  totalDoctors: number;
  profilesUpdated: number;
  accountsUpdated: number;
  profilesNotFound: number;
  errors: number;
}

async function migrateDoctorDenormalizedFields() {
  const logger = new Logger('MigrateDoctorFields');
  logger.log('Starting migration of doctor denormalized fields');

  const accountsPrisma = new AccountsPrisma({
    datasourceUrl: process.env.ACCOUNTS_DATABASE_URL,
  });

  const providerPrisma = new ProviderPrisma({
    datasourceUrl: process.env.PROVIDER_DATABASE_URL,
  });

  const stats: MigrationStats = {
    totalDoctors: 0,
    profilesUpdated: 0,
    accountsUpdated: 0,
    profilesNotFound: 0,
    errors: 0,
  };

  try {
    const doctorAccounts = await accountsPrisma.staffAccount.findMany({
      where: { role: 'DOCTOR', deletedAt: null },
      select: {
        id: true,
        fullName: true,
        isMale: true,
        email: true,
        doctorId: true,
      },
    });

    stats.totalDoctors = doctorAccounts.length;
    logger.log(`Found ${stats.totalDoctors} doctor accounts`);

    for (const account of doctorAccounts) {
      try {
        const doctorProfile = await providerPrisma.doctor.findUnique({
          where: { staffAccountId: account.id },
        });

        if (!doctorProfile) {
          logger.warn(`No profile found for account ${account.id}`);
          stats.profilesNotFound++;
          continue;
        }

        if (
          doctorProfile.fullName !== account.fullName ||
          doctorProfile.isMale !== account.isMale
        ) {
          await providerPrisma.doctor.update({
            where: { id: doctorProfile.id },
            data: { fullName: account.fullName, isMale: account.isMale },
          });
          stats.profilesUpdated++;
        }

        if (!account.doctorId || account.doctorId !== doctorProfile.id) {
          await accountsPrisma.staffAccount.update({
            where: { id: account.id },
            data: { doctorId: doctorProfile.id },
          });
          stats.accountsUpdated++;
        }
      } catch (error) {
        logger.error(
          `Error processing account ${account.id}: ${error.message}`,
        );
        stats.errors++;
      }
    }

    logger.log('\n=== Migration Summary ===');
    logger.log(
      `Total: ${stats.totalDoctors}, Updated: ${stats.profilesUpdated}, Errors: ${stats.errors}`,
    );
  } finally {
    await accountsPrisma.$disconnect();
    await providerPrisma.$disconnect();
  }
}

migrateDoctorDenormalizedFields().catch(console.error);
