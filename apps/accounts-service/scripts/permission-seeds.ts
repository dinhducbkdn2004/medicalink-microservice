import { PrismaClient } from '../prisma/generated/client';
import { config } from 'dotenv';
import { resolve } from 'path';
import { Logger } from '@nestjs/common';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient({
  datasourceUrl: process.env.ACCOUNTS_DATABASE_URL,
  log: ['error', 'warn'],
  errorFormat: 'pretty',
});

// Core permissions mapping based on microservice resources
const CORE_PERMISSIONS = [
  // Authentication & Profile
  { resource: 'auth', action: 'login', description: 'Login to the system' },
  { resource: 'auth', action: 'logout', description: 'Logout from the system' },
  {
    resource: 'auth',
    action: 'refresh',
    description: 'Refresh authentication token',
  },

  // Staff Management (Accounts Service) - Only for admin/super admin management
  {
    resource: 'staff',
    action: 'create',
    description: 'Create new admin/superadmin staff account',
  },
  {
    resource: 'staff',
    action: 'read',
    description: 'View admin/superadmin staff accounts',
  },
  {
    resource: 'staff',
    action: 'update',
    description: 'Update admin/superadmin staff accounts',
  },
  {
    resource: 'staff',
    action: 'delete',
    description: 'Delete admin/superadmin staff accounts',
  },
  {
    resource: 'staff',
    action: 'manage',
    description: 'Full admin/superadmin staff management access',
  },

  // Doctor Management
  {
    resource: 'doctors',
    action: 'create',
    description: 'Create new doctor account and profile',
  },
  {
    resource: 'doctors',
    action: 'read',
    description: 'View doctor account and profiles',
  },
  {
    resource: 'doctors',
    action: 'update',
    description: 'Update doctor account and profiles',
  },
  {
    resource: 'doctors',
    action: 'delete',
    description: 'Delete doctor accounts and profiles',
  },
  {
    resource: 'doctors',
    action: 'manage',
    description: 'Full doctor management access',
  },

  // Patient Management (Booking Service)
  {
    resource: 'patients',
    action: 'create',
    description: 'Create patient records',
  },
  { resource: 'patients', action: 'read', description: 'View patient records' },
  {
    resource: 'patients',
    action: 'update',
    description: 'Update patient records',
  },
  {
    resource: 'patients',
    action: 'delete',
    description: 'Delete patient records',
  },
  {
    resource: 'patients',
    action: 'manage',
    description: 'Full patient management access',
  },
  // Office Hours
  {
    resource: 'office-hours',
    action: 'create',
    description: 'Create office hours',
  },
  {
    resource: 'office-hours',
    action: 'read',
    description: 'View office hours',
  },
  {
    resource: 'office-hours',
    action: 'update',
    description: 'Update office hours',
  },
  {
    resource: 'office-hours',
    action: 'delete',
    description: 'Delete office hours',
  },
  {
    resource: 'office-hours',
    action: 'manage',
    description: 'Full office hours management access',
  },
  // Appointments Management (Booking Service)
  {
    resource: 'appointments',
    action: 'create',
    description: 'Create appointments',
  },
  {
    resource: 'appointments',
    action: 'read',
    description: 'View appointments',
  },
  {
    resource: 'appointments',
    action: 'update',
    description: 'Update appointments',
  },
  {
    resource: 'appointments',
    action: 'delete',
    description: 'Cancel/delete appointments',
  },
  {
    resource: 'appointments',
    action: 'manage',
    description: 'Full appointment management',
  },
  {
    resource: 'specialties',
    action: 'create',
    description: 'Create specialties',
  },
  { resource: 'specialties', action: 'read', description: 'View specialties' },
  {
    resource: 'specialties',
    action: 'update',
    description: 'Update specialties',
  },
  {
    resource: 'specialties',
    action: 'delete',
    description: 'Delete specialties',
  },
  {
    resource: 'specialties',
    action: 'manage',
    description: 'Full specialties management access',
  },

  {
    resource: 'work-locations',
    action: 'create',
    description: 'Create work locations',
  },
  {
    resource: 'work-locations',
    action: 'read',
    description: 'View work locations',
  },
  {
    resource: 'work-locations',
    action: 'update',
    description: 'Update work locations',
  },
  {
    resource: 'work-locations',
    action: 'delete',
    description: 'Delete work locations',
  },
  {
    resource: 'work-locations',
    action: 'manage',
    description: 'Full work locations management access',
  },

  {
    resource: 'schedules',
    action: 'create',
    description: 'Create doctor schedules',
  },
  {
    resource: 'schedules',
    action: 'read',
    description: 'View doctor schedules',
  },
  {
    resource: 'schedules',
    action: 'update',
    description: 'Update doctor schedules',
  },
  {
    resource: 'schedules',
    action: 'delete',
    description: 'Delete doctor schedules',
  },
  {
    resource: 'schedules',
    action: 'manage',
    description: 'Full doctor schedules management access',
  },

  // Content Management
  { resource: 'blogs', action: 'create', description: 'Create blog posts' },
  { resource: 'blogs', action: 'read', description: 'View blog posts' },
  { resource: 'blogs', action: 'update', description: 'Update blog posts' },
  { resource: 'blogs', action: 'delete', description: 'Delete blog posts' },
  { resource: 'blogs', action: 'publish', description: 'Publish blog posts' },
  {
    resource: 'blogs',
    action: 'manage',
    description: 'Full blog management access',
  },
  // Q&A management
  {
    resource: 'questions',
    action: 'create',
    description: 'Create Q&A questions',
  },
  { resource: 'questions', action: 'read', description: 'View Q&A questions' },
  {
    resource: 'questions',
    action: 'update',
    description: 'Update Q&A questions',
  },
  {
    resource: 'questions',
    action: 'delete',
    description: 'Delete Q&A questions',
  },
  {
    resource: 'questions',
    action: 'manage',
    description: 'Full Q&A questions management access',
  },
  // Answers
  {
    resource: 'answers',
    action: 'create',
    description: 'Create answers for Q&A questions',
  },
  { resource: 'answers', action: 'read', description: 'View Q&A answers' },
  { resource: 'answers', action: 'update', description: 'Update Q&A answers' },
  { resource: 'answers', action: 'delete', description: 'Delete Q&A answers' },
  {
    resource: 'answers',
    action: 'manage',
    description: 'Full Q&A answers management access',
  },
  // Reviews
  { resource: 'reviews', action: 'read', description: 'View reviews' },
  {
    resource: 'reviews',
    action: 'update',
    description: 'Update reviews',
  },
  {
    resource: 'reviews',
    action: 'delete',
    description: 'Delete reviews',
  },
  {
    resource: 'reviews',
    action: 'manage',
    description: 'Full reviews management access',
  },
  // Notifications
  {
    resource: 'notifications',
    action: 'send',
    description: 'Send notifications',
  },
  {
    resource: 'notifications',
    action: 'read',
    description: 'View notifications',
  },
  {
    resource: 'notifications',
    action: 'manage',
    description: 'Manage notification settings',
  },

  // System Administration
  {
    resource: 'system',
    action: 'admin',
    description: 'System administration access',
  },
  {
    resource: 'permissions',
    action: 'manage',
    description: 'Manage user permissions',
  },
  { resource: 'groups', action: 'manage', description: 'Manage user groups' },
];

// Default groups based on current roles
const DEFAULT_GROUPS = [
  {
    name: 'super_admin',
    description: 'Super Administrator with full system access',
    tenantId: 'global',
  },
  {
    name: 'admin',
    description: 'Administrator with management access',
    tenantId: 'global',
  },
  {
    name: 'doctor',
    description: 'Doctor with patient care access',
    tenantId: 'global',
  },
];

// Role-based permission mapping
const ROLE_PERMISSION_MAPPING = {
  SUPER_ADMIN: {
    regular: [
      'system:admin',
      'permissions:manage',
      'groups:manage',
      'staff:manage',
      'doctors:manage',
      'patients:manage',
      'appointments:manage',
      'doctors:manage',
      'specialties:manage',
      'work-locations:manage',
      'office-hours:manage',
      'schedules:manage',
      'blogs:manage',
      'questions:manage',
      'answers:manage',
      'reviews:manage',
      'notifications:manage',
    ],
    conditional: [],
  },
  ADMIN: {
    regular: [
      'staff:read',
      'doctors:manage',
      'patients:manage',
      'appointments:manage',
      'doctors:manage',
      'specialties:read',
      'specialties:update',
      'work-locations:manage',
      'schedules:manage',
      'office-hours:manage',
      'blogs:manage',
      'questions:manage',
      'answers:manage',
      'reviews:manage',
      'notifications:send',
      'notifications:read',
    ],
    conditional: [
      {
        permission: 'staff:update',
        conditions: [{ field: 'isSelf', operator: 'eq', value: true }],
      },
    ],
  },
  DOCTOR: {
    regular: [
      'doctors:read',
      'patients:read',
      'patients:update',
      'appointments:read',
      'appointments:update',
      'doctors:read',
      'office-hours:read',
      'schedules:read',
      'schedules:update',
      'blogs:read',
      'blogs:create',
      'questions:read',
      'answers:read',
      'answers:create',
      'notifications:read',
    ],
    conditional: [
      {
        permission: 'doctors:update',
        conditions: [{ field: 'isSelf', operator: 'eq', value: true }],
      },
      {
        permission: 'blogs:update',
        conditions: [{ field: 'isSelf', operator: 'eq', value: true }],
      },
      {
        permission: 'blogs:delete',
        conditions: [{ field: 'isSelf', operator: 'eq', value: true }],
      },
      {
        permission: 'answers:update',
        conditions: [{ field: 'isSelf', operator: 'eq', value: true }],
      },
      {
        permission: 'answers:delete',
        conditions: [{ field: 'isSelf', operator: 'eq', value: true }],
      },
    ],
  },
};

export async function seedPermissions() {
  Logger.log('Seeding permissions...');

  try {
    // Test database connection first
    Logger.log('Testing database connection...');
    await prisma.$connect();
    Logger.log('Database connected successfully');

    // 1. Create core permissions in batches
    Logger.log('Creating core permissions...');
    const batchSize = 10;
    for (let i = 0; i < CORE_PERMISSIONS.length; i += batchSize) {
      const batch = CORE_PERMISSIONS.slice(i, i + batchSize);

      for (const permission of batch) {
        try {
          await prisma.permission.upsert({
            where: {
              resource_action: {
                resource: permission.resource,
                action: permission.action,
              },
            },
            update: {
              description: permission.description,
            },
            create: permission,
          });
        } catch (error) {
          Logger.error(
            `Failed to create permission ${permission.resource}:${permission.action}:`,
            error.message,
          );
          // Continue with next permission instead of failing completely
        }
      }

      Logger.log(
        `Processed ${Math.min(i + batchSize, CORE_PERMISSIONS.length)}/${CORE_PERMISSIONS.length} permissions`,
      );

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < CORE_PERMISSIONS.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // 2. Create default groups
    Logger.log('Creating default groups...');
    const createdGroups: Record<string, any> = {};
    for (const group of DEFAULT_GROUPS) {
      createdGroups[group.name] = await prisma.group.upsert({
        where: {
          name_tenantId: {
            name: group.name,
            tenantId: group.tenantId as any,
          },
        },
        update: {
          description: group.description,
        },
        create: group,
      });
    }

    // 3. Assign permissions to groups
    Logger.log('Assigning permissions to groups...');
    for (const [roleName, permissionConfig] of Object.entries(
      ROLE_PERMISSION_MAPPING,
    )) {
      const groupName = roleName.toLowerCase();
      const group = createdGroups[groupName];

      if (!group) continue;

      // Handle regular permissions
      for (const permissionPattern of permissionConfig.regular) {
        const [resource, action] = permissionPattern.split(':');

        // Assign specific permission (no more wildcard support)
        const permission = await prisma.permission.findUnique({
          where: {
            resource_action: { resource, action },
          },
        });

        if (permission) {
          await prisma.groupPermission.upsert({
            where: {
              groupId_permissionId: {
                groupId: group.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: {
              groupId: group.id,
              permissionId: permission.id,
              effect: 'ALLOW',
            },
          });
        } else {
          Logger.warn(`Permission not found: ${resource}:${action}`);
        }
      }

      // Handle conditional permissions
      for (const conditionalPerm of permissionConfig.conditional) {
        const [resource, action] = conditionalPerm.permission.split(':');

        const permission = await prisma.permission.findUnique({
          where: {
            resource_action: { resource, action },
          },
        });

        if (permission) {
          await prisma.groupPermission.upsert({
            where: {
              groupId_permissionId: {
                groupId: group.id,
                permissionId: permission.id,
              },
            },
            update: {
              conditions: conditionalPerm.conditions,
            },
            create: {
              groupId: group.id,
              permissionId: permission.id,
              effect: 'ALLOW',
              conditions: conditionalPerm.conditions,
            },
          });
          Logger.log(
            `Added conditional permission ${conditionalPerm.permission} for ${roleName} group with condition: ${JSON.stringify(conditionalPerm.conditions)}`,
          );
        } else {
          Logger.warn(
            `Conditional permission not found: ${resource}:${action}`,
          );
        }
      }
    }

    Logger.log('Permissions seeded successfully!');

    // Summary
    const permissionCount = await prisma.permission.count();
    const groupCount = await prisma.group.count();
    const groupPermissionCount = await prisma.groupPermission.count();

    Logger.log(`Summary:`);
    Logger.log(`  - Permissions: ${permissionCount}`);
    Logger.log(`  - Groups: ${groupCount}`);
    Logger.log(`  - Group Permissions: ${groupPermissionCount}`);
  } catch (error) {
    Logger.error('Error seeding permissions:', error);
    throw error;
  }
}

export async function migrateExistingUsers() {
  Logger.log('Migrating existing users to permission system...');

  try {
    // Get all existing staff accounts
    const staffAccounts = await prisma.staffAccount.findMany({
      where: { deletedAt: null },
    });

    Logger.log(`Found ${staffAccounts.length} staff accounts to migrate`);

    for (const staff of staffAccounts) {
      // 1. Create auth version record
      await prisma.authVersion.upsert({
        where: { userId: staff.id },
        update: { version: 1 },
        create: {
          userId: staff.id,
          version: 1,
        },
      });

      // 2. Assign user to appropriate group based on role
      const groupName = staff.role.toLowerCase();
      const group = await prisma.group.findFirst({
        where: {
          name: groupName,
          tenantId: 'global',
        },
      });

      if (group) {
        await prisma.userGroup.upsert({
          where: {
            userId_groupId_tenantId: {
              userId: staff.id,
              groupId: group.id,
              tenantId: 'global',
            },
          },
          update: {},
          create: {
            userId: staff.id,
            groupId: group.id,
            tenantId: 'global',
          },
        });

        Logger.log(
          `Migrated ${staff.email} (${staff.role}) to group ${groupName}`,
        );
      } else {
        Logger.warn(`  Group not found for role: ${staff.role}`);
      }
    }

    Logger.log(' User migration completed!');
  } catch (error) {
    Logger.error(' Error migrating users:', error);
    throw error;
  }
}

// Function to invalidate all user permission caches
async function invalidateAllUserCaches() {
  Logger.log('Invalidating permission caches for all users...');

  try {
    // Get all users with auth versions
    const authVersions = await prisma.authVersion.findMany();

    // Increment auth version for each user to invalidate their cache
    for (const authVersion of authVersions) {
      await prisma.authVersion.update({
        where: { userId: authVersion.userId },
        data: {
          version: authVersion.version + 1,
          updatedAt: new Date(),
        },
      });
    }

    Logger.log('All user permission caches invalidated successfully!');
  } catch (error) {
    Logger.error('Error invalidating user caches:', error);
    throw error;
  }
}

// Main seed function
export async function main() {
  try {
    await seedPermissions();
    await migrateExistingUsers();
    await invalidateAllUserCaches();
  } catch (error) {
    Logger.error('Error in seed script:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  void main();
}
