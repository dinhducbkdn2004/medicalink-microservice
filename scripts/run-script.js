#!/usr/bin/env node

/**
 * Script Runner for Medicalink Microservice
 *
 * Usage: pnpm run script -- --service={service_name} --filename={file_name}
 * Example: pnpm run script -- --service=accounts-service --filename=create-super-admin
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
let serviceName = '';
let fileName = '';

// Parse arguments
args.forEach((arg) => {
  if (arg.startsWith('--service=')) {
    serviceName = arg.split('=')[1];
  } else if (arg.startsWith('--filename=')) {
    fileName = arg.split('=')[1];
  }
});

// Validate required parameters
if (!fileName) {
  console.error('Error: --filename parameter is required');
  console.error(
    'Usage: pnpm run script -- --filename={file_name} [--service={service_name}]',
  );
  console.error(
    'Example: pnpm run script -- --filename=create-super-admin --service=accounts-service',
  );
  console.error(
    'Example: pnpm run script -- --filename=my-script (runs from root scripts folder)',
  );
  process.exit(1);
}

// Determine script path and working directory
let scriptPath;
let workingDir;
let tsconfigPath;

if (serviceName) {
  // Validate service directory exists
  const servicePath = path.join(__dirname, '..', 'apps', serviceName);
  if (!fs.existsSync(servicePath)) {
    console.error(
      `Error: Service directory '${serviceName}' not found in apps/`,
    );
    console.error('Available services:');
    const appsDir = path.join(__dirname, '..', 'apps');
    if (fs.existsSync(appsDir)) {
      const services = fs
        .readdirSync(appsDir)
        .filter((item) => fs.statSync(path.join(appsDir, item)).isDirectory());
      services.forEach((service) => console.error(`  - ${service}`));
    }
    process.exit(1);
  }

  // Script is in service folder
  scriptPath = path.join(servicePath, 'scripts', `${fileName}.ts`);
  workingDir = servicePath;
  tsconfigPath = path.join(servicePath, 'tsconfig.app.json');
} else {
  // Script is in root scripts folder
  scriptPath = path.join(__dirname, `${fileName}.ts`);
  workingDir = path.join(__dirname, '..');
  tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
}

// Validate script file exists
if (!fs.existsSync(scriptPath)) {
  if (serviceName) {
    console.error(
      `Error: Script file '${fileName}.ts' not found in apps/${serviceName}/scripts/`,
    );
    console.error('Available scripts:');
    const scriptsDir = path.join(workingDir, 'scripts');
    if (fs.existsSync(scriptsDir)) {
      const scripts = fs
        .readdirSync(scriptsDir)
        .filter((file) => file.endsWith('.ts'));
      scripts.forEach((script) =>
        console.error(`  - ${script.replace('.ts', '')}`),
      );
    } else {
      console.error(`  No scripts directory found in apps/${serviceName}/`);
    }
  } else {
    console.error(
      `Error: Script file '${fileName}.ts' not found in root scripts folder`,
    );
    console.error('Available scripts:');
    const scriptsDir = __dirname;
    if (fs.existsSync(scriptsDir)) {
      const scripts = fs
        .readdirSync(scriptsDir)
        .filter((file) => file.endsWith('.ts'));
      scripts.forEach((script) =>
        console.error(`  - ${script.replace('.ts', '')}`),
      );
    }
  }
  process.exit(1);
}

// Validate tsconfig file exists
if (!fs.existsSync(tsconfigPath)) {
  if (serviceName) {
    console.error(`Error: tsconfig.app.json not found in apps/${serviceName}/`);
  } else {
    console.error(`Error: tsconfig.json not found in root directory`);
  }
  process.exit(1);
}

try {
  if (serviceName) {
    console.log(`Running script: ${fileName}.ts in ${serviceName} service...`);
  } else {
    console.log(`Running script: ${fileName}.ts from root scripts folder...`);
  }
  console.log(`Working directory: ${workingDir}`);
  console.log(`Script file: ${scriptPath}`);
  console.log('');

  // Build the command based on whether it's a service script or root script
  let command;
  if (serviceName) {
    command = `cd "${workingDir}" && npx ts-node --project tsconfig.app.json -r tsconfig-paths/register scripts/${fileName}.ts`;
  } else {
    command = `cd "${workingDir}" && npx ts-node --project tsconfig.json -r tsconfig-paths/register scripts/${fileName}.ts`;
  }

  // Preserve environment variables (including DOTENV_CONFIG_PATH)
  const env = { ...process.env };

  execSync(command, {
    stdio: 'inherit',
    cwd: workingDir,
    env: env,
  });

  console.log('');
  console.log('Script executed successfully!');
} catch (error) {
  console.error('');
  console.error('Script execution failed:');
  console.error(error.message);
  process.exit(1);
}
