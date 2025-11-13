#!/usr/bin/env ts-node

/**
 * Cleanup Orphan Doctor Profiles Script
 *
 * This script finds and deletes doctor profiles that are orphaned:
 * - Profiles where the associated staff account doesn't exist
 * - Profiles where the associated staff account is soft deleted
 * - Profiles where the associated staff account is not a DOCTOR role
 *
 * Usage:
 *   pnpm run script -- --filename=cleanup-orphan-doctor-profiles [--verbose]
 *
 * With custom env file:
 *   DOTENV_CONFIG_PATH=.env.production pnpm run script -- --filename=cleanup-orphan-doctor-profiles
 */

import { PrismaClient as AccountsPrismaClient } from '../apps/accounts-service/prisma/generated/client';
import { PrismaClient as ProviderPrismaClient } from '../apps/provider-directory-service/prisma/generated/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from custom file if specified
const envFile = process.env.DOTENV_CONFIG_PATH || '.env';
const envPath = path.resolve(process.cwd(), envFile);

console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

// Replace Docker hostname with localhost when running from host
if (process.env.ACCOUNTS_DATABASE_URL?.includes('@postgres:')) {
  process.env.ACCOUNTS_DATABASE_URL = process.env.ACCOUNTS_DATABASE_URL.replace(
    '@postgres:',
    '@localhost:',
  );
}
if (process.env.PROVIDER_DATABASE_URL?.includes('@postgres:')) {
  process.env.PROVIDER_DATABASE_URL = process.env.PROVIDER_DATABASE_URL.replace(
    '@postgres:',
    '@localhost:',
  );
}

// Parse command line arguments
const isVerbose = process.argv.includes('--verbose');

// Initialize Prisma clients
const accountsPrisma = new AccountsPrismaClient({
  log: isVerbose ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

const providerPrisma = new ProviderPrismaClient({
  log: isVerbose ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

interface OrphanProfile {
  id: string;
  staffAccountId: string;
  reason: string;
}

async function findOrphanProfiles(): Promise<OrphanProfile[]> {
  console.log('\n=== Scanning for orphan profiles ===\n');

  const allProfiles = await providerPrisma.doctor.findMany({
    select: {
      id: true,
      staffAccountId: true,
    },
  });

  console.log(`Found ${allProfiles.length} total doctor profiles`);

  const orphanProfiles: OrphanProfile[] = [];

  for (const profile of allProfiles) {
    const account = await accountsPrisma.staffAccount.findUnique({
      where: { id: profile.staffAccountId },
      select: {
        id: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!account) {
      orphanProfiles.push({
        id: profile.id,
        staffAccountId: profile.staffAccountId,
        reason: 'Account does not exist',
      });
      continue;
    }

    if (account.deletedAt) {
      orphanProfiles.push({
        id: profile.id,
        staffAccountId: profile.staffAccountId,
        reason: `Account is soft deleted (deletedAt: ${account.deletedAt.toISOString()})`,
      });
      continue;
    }

    if (account.role !== 'DOCTOR') {
      orphanProfiles.push({
        id: profile.id,
        staffAccountId: profile.staffAccountId,
        reason: `Account role is ${account.role}, not DOCTOR`,
      });
      continue;
    }
  }

  return orphanProfiles;
}

async function main() {
  try {
    console.log('\n=== Doctor Profile Cleanup ===');
    console.log(`Environment file: ${envPath}\n`);

    const orphanProfiles = await findOrphanProfiles();

    if (orphanProfiles.length === 0) {
      console.log('\n✓ No orphan profiles found. Database is clean!');
      return;
    }

    console.log(`\n=== Found ${orphanProfiles.length} orphan profiles ===\n`);

    orphanProfiles.forEach((profile, index) => {
      console.log(
        `${index + 1}. Profile ID: ${profile.id}`,
        `\n   Staff Account ID: ${profile.staffAccountId}`,
        `\n   Reason: ${profile.reason}\n`,
      );
    });

    console.log(
      `\n=== Deleting ${orphanProfiles.length} orphan profiles ===\n`,
    );

    let deletedCount = 0;
    let failedCount = 0;

    for (const profile of orphanProfiles) {
      try {
        await providerPrisma.doctor.delete({
          where: { id: profile.id },
        });
        console.log(`✓ Deleted profile ${profile.id} (${profile.reason})`);
        deletedCount++;
      } catch (error) {
        console.error(
          `✗ Failed to delete profile ${profile.id}:`,
          error instanceof Error ? error.message : String(error),
        );
        failedCount++;
      }
    }

    console.log(
      `\n✓ Cleanup completed. Deleted: ${deletedCount}, Failed: ${failedCount}`,
    );
  } catch (error) {
    console.error('\nCleanup failed:', error);
    process.exit(1);
  } finally {
    await accountsPrisma.$disconnect();
    await providerPrisma.$disconnect();
  }
}

void main();
