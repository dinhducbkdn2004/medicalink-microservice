#!/usr/bin/env ts-node

/**
 * Cleanup Orphan Doctor Profiles Script
 *
 * This script finds and optionally deletes doctor profiles that are orphaned:
 * - Profiles where the associated staff account doesn't exist
 * - Profiles where the associated staff account is soft deleted
 * - Profiles where the associated staff account is not a DOCTOR role
 *
 * Usage:
 *   pnpm run script -- --filename=cleanup-orphan-doctor-profiles [--execute] [--verbose]
 *
 * With custom env file:
 *   DOTENV_CONFIG_PATH=.env.production pnpm run script -- --filename=cleanup-orphan-doctor-profiles --execute
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

// Parse command line arguments
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const isVerbose = args.includes('--verbose');

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

async function deleteProfiles(profiles: OrphanProfile[]): Promise<void> {
  if (profiles.length === 0) {
    console.log('\nNo orphan profiles to delete.');
    return;
  }

  console.log(`\n=== Deleting ${profiles.length} orphan profiles ===\n`);

  for (const profile of profiles) {
    try {
      await providerPrisma.doctor.delete({
        where: { id: profile.id },
      });
      console.log(`✓ Deleted profile ${profile.id} (${profile.reason})`);
    } catch (error) {
      console.error(
        `✗ Failed to delete profile ${profile.id}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

function maskConnectionString(url: string | undefined): string {
  if (!url) return 'not set';
  try {
    const urlObj = new URL(url);
    if (urlObj.password) {
      urlObj.password = '***';
    }
    return urlObj.toString();
  } catch {
    return url ? '***' : 'not set';
  }
}

async function main() {
  try {
    console.log('\n=== Doctor Profile Cleanup ===');
    console.log(`Mode: ${isExecute ? 'EXECUTE (will delete)' : 'dry-run'}`);
    console.log(`Environment file: ${envPath}`);
    console.log(
      `Accounts DB: ${maskConnectionString(process.env.ACCOUNTS_DATABASE_URL)}`,
    );
    console.log(
      `Provider DB: ${maskConnectionString(process.env.PROVIDER_DATABASE_URL)}\n`,
    );

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

    if (!isExecute) {
      console.log(
        '\n⚠ This was a dry-run. No profiles were deleted.',
        '\nTo actually delete these profiles, run with --execute flag:',
        '\n  pnpm run script -- --filename=cleanup-orphan-doctor-profiles --execute\n',
      );
      return;
    }

    // Confirm deletion
    console.log(
      `\n⚠ WARNING: About to delete ${orphanProfiles.length} orphan profiles.`,
    );
    console.log('This action cannot be undone!\n');

    await deleteProfiles(orphanProfiles);

    console.log(
      `\n✓ Cleanup completed. ${orphanProfiles.length} profiles processed.`,
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
