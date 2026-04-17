#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const rawArgs = process.argv.slice(2);

function readOption(name, fallback) {
  const index = rawArgs.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = rawArgs[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${name}`);
    process.exit(1);
  }

  return value;
}

if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
  console.log(`Usage:
  npm run rollout:apphosting -- [--branch release | --commit SHA] [--backend studio]

Examples:
  npm run rollout:apphosting
  npm run rollout:apphosting -- --branch prod
  npm run rollout:apphosting -- --commit abc1234
`);
  process.exit(0);
}

const backend = readOption('--backend', 'studio');
const branch = readOption('--branch', 'release');
const commit = readOption('--commit', null);

if (branch && commit) {
  console.error('Choose either --branch or --commit, not both.');
  process.exit(1);
}

const firebaseArgs = ['apphosting:rollouts:create', backend, '--force'];

if (commit) {
  firebaseArgs.push('--git-commit', commit);
} else {
  firebaseArgs.push('--git-branch', branch);
}

console.log(
  commit
    ? `Creating a manual App Hosting rollout for backend "${backend}" from commit ${commit}.`
    : `Creating a manual App Hosting rollout for backend "${backend}" from branch "${branch}".`,
);

const firebaseCommand = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
const result = spawnSync(firebaseCommand, firebaseArgs, {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
