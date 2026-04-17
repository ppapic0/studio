#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const BACKEND_ID = 'studio';
const rawArgs = process.argv.slice(2);

const usage = `Usage:
  npm run deploy -- <target> [--dry-run] [--confirm]

Targets:
  functions         Deploy Cloud Functions only
  firestore         Deploy Firestore rules + indexes
  firestore:rules   Deploy Firestore rules only
  firestore:indexes Deploy Firestore indexes only
  apphosting        Deploy Firebase App Hosting backend "${BACKEND_ID}" from local source
  all               Deploy every configured Firebase target (requires --confirm)

Examples:
  npm run deploy -- functions
  npm run deploy:functions
  npm run deploy -- firestore:rules
  npm run deploy -- apphosting
  npm run deploy:all
`;

const target = rawArgs.find((arg) => !arg.startsWith('--'));
const dryRun = rawArgs.includes('--dry-run');
const confirmed = rawArgs.includes('--confirm');
const helpRequested = rawArgs.includes('--help') || rawArgs.includes('-h');

if (helpRequested || !target) {
  console.log(usage);
  console.log(
    'Why this guard exists: the old `firebase deploy` also deployed App Hosting, which triggers a new Cloud Build from source.',
  );
  process.exit(helpRequested ? 0 : 1);
}

const targetMap = {
  functions: ['deploy', '--only', 'functions'],
  firestore: ['deploy', '--only', 'firestore'],
  'firestore:rules': ['deploy', '--only', 'firestore:rules'],
  'firestore:indexes': ['deploy', '--only', 'firestore:indexes'],
  apphosting: ['deploy', '--only', `apphosting:${BACKEND_ID}`],
  all: ['deploy'],
};

const firebaseArgs = targetMap[target];

if (!firebaseArgs) {
  console.error(`Unknown deploy target: ${target}`);
  console.log(usage);
  process.exit(1);
}

if (target === 'all' && !confirmed) {
  console.error(
    'Refusing to run a full Firebase deploy without --confirm because it can trigger App Hosting Cloud Build and extra rollout cost.',
  );
  console.error('Use `npm run deploy:all` or `npm run deploy -- all --confirm` if you really want a full deploy.');
  process.exit(1);
}

if (target === 'apphosting' || target === 'all') {
  console.log('This command can trigger a new App Hosting source build in Cloud Build.');
}

if (dryRun) {
  firebaseArgs.push('--dry-run');
}

const firebaseCommand = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
const result = spawnSync(firebaseCommand, firebaseArgs, {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
