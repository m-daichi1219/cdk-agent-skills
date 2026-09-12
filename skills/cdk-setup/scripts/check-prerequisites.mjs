#!/usr/bin/env node
/**
 * Reports everything about the environment that can be detected, so the agent never asks the user
 * for something a machine can answer. Exits non-zero only for a real blocker.
 *
 *   node check-prerequisites.mjs --target infrastructure [--json]
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  MINIMUM_NODE_VERSION,
  bad,
  compareVersions,
  detectAwsRegion,
  die,
  findRepositoryRoot,
  info,
  isDirectoryEmpty,
  ok,
  probeVersion,
  readJson,
  say,
  warn,
} from './lib/common.mjs';

const { values } = parseArgs({
  options: {
    target: { type: 'string', default: '.' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  say('usage: node check-prerequisites.mjs [--target <dir>] [--json]');
  process.exit(0);
}

const targetDir = path.resolve(process.cwd(), values.target);
const blockers = [];
const warnings = [];

// --- runtime ---------------------------------------------------------------------------------
const nodeVersion = process.versions.node;
const nodeMajor = Number.parseInt(nodeVersion.split('.')[0], 10);
const nodeSupported = compareVersions(nodeVersion, MINIMUM_NODE_VERSION) >= 0;

if (!nodeSupported) {
  blockers.push(
    `Node.js ${nodeVersion} is too old. Install Node.js >= ${MINIMUM_NODE_VERSION} (LTS line).`,
  );
}
if (nodeSupported && nodeMajor % 2 !== 0) {
  warnings.push(
    `Node.js ${nodeVersion} is an odd-numbered (non-LTS) release. Prefer the current LTS line.`,
  );
}

// --- package managers ------------------------------------------------------------------------
// The corepack shim can download a package manager on first use, so allow a generous timeout.
const packageManagers = {
  pnpm: probeVersion('pnpm', ['--version'], 180_000),
  npm: probeVersion('npm', ['--version'], 60_000),
  yarn: probeVersion('yarn', ['--version'], 60_000),
};

if (!packageManagers.pnpm && !packageManagers.npm) {
  blockers.push('No usable package manager found (looked for pnpm and npm).');
}

// --- other tooling ---------------------------------------------------------------------------
const git = probeVersion('git');
const awsCli = probeVersion('aws');
const corepack = probeVersion('corepack');
const region = detectAwsRegion();
const repositoryRoot = findRepositoryRoot(existsSync(targetDir) ? targetDir : process.cwd());

if (!git) warnings.push('git not found: the generated project will not be version controlled.');
if (!awsCli) {
  warnings.push('AWS CLI not found: fine for setup, needed later for identity checks and deploys.');
}

// --- target directory ------------------------------------------------------------------------
const targetExists = existsSync(targetDir);
const targetEntries = targetExists ? readdirSync(targetDir).filter((e) => e !== '.git') : [];
const targetEmpty = isDirectoryEmpty(targetDir);

const existingCdkProject =
  targetExists &&
  (existsSync(path.join(targetDir, 'cdk.json')) ||
    (existsSync(path.join(targetDir, 'package.json')) &&
      (() => {
        try {
          const manifest = readJson(path.join(targetDir, 'package.json'));
          return Boolean(
            manifest.dependencies?.['aws-cdk-lib'] ?? manifest.devDependencies?.['aws-cdk-lib'],
          );
        } catch {
          return false;
        }
      })()));

if (existingCdkProject) {
  blockers.push(
    `${targetDir} already contains a CDK project. cdk-setup v1 targets empty or new directories; ` +
      'migrating an existing project is out of scope — stop and report this to the user.',
  );
} else if (!targetEmpty) {
  warnings.push(
    `${targetDir} is not empty (${targetEntries.length} entries). Generation will refuse to ` +
      'overwrite existing files; confirm the directory with the user.',
  );
}

const existingLockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'].filter((file) =>
  existsSync(path.join(targetDir, file)),
);
if (existingLockFiles.length > 0) {
  warnings.push(
    `Existing lock file(s) in the target: ${existingLockFiles.join(', ')}. Keep the package ` +
      'manager the project already uses.',
  );
}

// --- report ----------------------------------------------------------------------------------
const report = {
  node: { version: nodeVersion, minimum: MINIMUM_NODE_VERSION, supported: nodeSupported },
  packageManagers,
  recommendedPackageManager: packageManagers.pnpm ? 'pnpm' : (packageManagers.npm && 'npm') || null,
  git,
  awsCli,
  corepack,
  awsRegion: region,
  repositoryRoot,
  target: {
    path: targetDir,
    exists: targetExists,
    empty: targetEmpty,
    entries: targetEntries,
    existingCdkProject,
    existingLockFiles,
  },
  blockers,
  warnings,
};

if (values.json) {
  say(JSON.stringify(report, null, 2));
  process.exit(blockers.length > 0 ? 1 : 0);
}

say('cdk-setup prerequisites');
say('');
say('Runtime');
const optional = (version, label) => (version ? ok(`${label} ${version}`) : info(`${label} not available`));

if (nodeSupported) {
  ok(`Node.js ${nodeVersion} (minimum ${MINIMUM_NODE_VERSION})`);
} else {
  bad(`Node.js ${nodeVersion} (minimum ${MINIMUM_NODE_VERSION})`);
}

for (const [name, version] of Object.entries(packageManagers)) {
  optional(version, name);
}
optional(corepack, 'corepack');
optional(git, 'git');
optional(awsCli, 'aws cli');
info(`aws region ${region ?? 'not configured (ask the user)'}`);

say('');
say('Repository');
info(`repository root  ${repositoryRoot ?? 'not a git repository'}`);
info(`target directory ${targetDir}`);
info(`target state     ${!targetExists ? 'does not exist yet' : targetEmpty ? 'empty' : 'not empty'}`);

if (warnings.length > 0) {
  say('');
  say('Warnings');
  warnings.forEach(warn);
}

if (blockers.length > 0) {
  say('');
  say('Blockers');
  blockers.forEach(bad);
  die('resolve the blockers above before generating the project');
}

say('');
say(`Ready. Recommended package manager: ${report.recommendedPackageManager}.`);
