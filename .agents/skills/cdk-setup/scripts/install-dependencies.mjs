#!/usr/bin/env node
/**
 * Installs the toolchain at the versions that are stable *now*, then formats the generated sources.
 *
 * Version policy: latest stable at run time, pinned afterwards by package.json + the lock file. The
 * one exception is TypeScript, which is resolved to the newest version the installed
 * `typescript-eslint` declares support for — installing a TypeScript major that the linter cannot
 * parse yet would break `lint` for no benefit.
 *
 *   node install-dependencies.mjs --target infrastructure --package-manager pnpm
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  PACKAGE_MANAGERS,
  die,
  info,
  ok,
  printVersions,
  readJson,
  resolvePackageManager,
  run,
  say,
  warn,
} from './lib/common.mjs';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    'package-manager': { type: 'string', default: 'pnpm' },
    'skip-format': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.target) {
  say(
    'usage: node install-dependencies.mjs --target <dir> [--package-manager pnpm|npm|yarn] ' +
      '[--skip-format]',
  );
  process.exit(values.help ? 0 : 1);
}

const targetDir = path.resolve(process.cwd(), values.target);
const packageManager = resolvePackageManager(values['package-manager']);
const commands = PACKAGE_MANAGERS[packageManager];

if (!existsSync(path.join(targetDir, 'package.json'))) {
  die(`${targetDir} has no package.json — run initialize-project.mjs first`);
}

const runtimeDependencies = ['aws-cdk-lib', 'constructs', 'cdk-nag'];
const developmentDependencies = [
  'aws-cdk',
  'tsx',
  // Match the types to the running Node.js major: the `latest` tag on @types/node often trails the
  // current LTS, and mismatched types produce errors that look like project bugs.
  `@types/node@^${process.versions.node.split('.')[0]}`,
  'vitest',
  // vitest declares vite as a required (non-optional) peer dependency.
  'vite',
  'eslint',
  '@eslint/js',
  'typescript-eslint',
  'eslint-config-prettier',
  'prettier',
];

const install = (label, args) => {
  say('');
  say(`> ${packageManager} ${args.join(' ')}`);
  // No timeout: a cold cache on a slow network legitimately takes many minutes, and killing the
  // install half way leaves a worse mess than waiting.
  const result = run(packageManager, args, { cwd: targetDir, inherit: true });

  if (result.error) {
    die(`${label} could not run: ${result.error.message}`);
  }

  if (result.status !== 0) {
    say('');
    if (packageManager === 'pnpm') {
      warn(
        'If the error is ERR_PNPM_IGNORED_BUILDS: a dependency wants to run an install script. ' +
          'List those packages for the user and let them decide — approving a build script runs ' +
          "that package's code on this machine. Approve only what they agree to " +
          '(`pnpm approve-builds <package>`).',
      );
    }
    die(
      `${label} failed (exit ${result.status}). Report the real error; do not retry with a ` +
        'different version set unless the user agrees.',
    );
  }
};

install('runtime dependency install', [...commands.addProd, ...runtimeDependencies]);
install('dev dependency install', [...commands.addDev, ...developmentDependencies]);

// --- TypeScript, constrained by what the linter supports ---------------------------------------
const typescriptEslintManifest = path.join(
  targetDir,
  'node_modules',
  'typescript-eslint',
  'package.json',
);

let typescriptSpec = 'typescript@latest';
if (existsSync(typescriptEslintManifest)) {
  const peerRange = readJson(typescriptEslintManifest).peerDependencies?.typescript;
  if (peerRange) {
    typescriptSpec = `typescript@${peerRange}`;
    info(`typescript-eslint supports typescript ${peerRange}`);
  } else {
    warn('typescript-eslint declares no typescript peer range: installing the latest version');
  }
} else {
  warn('typescript-eslint is not installed: installing the latest typescript');
}

install('typescript install', [...commands.addDev, typescriptSpec]);

// --- recommended CDK feature flags -------------------------------------------------------------
// A new project should start with the feature flags AWS recommends for the installed CDK version;
// without them the app silently keeps legacy behaviour. Rather than hard-coding a list that rots,
// ask the installed CLI: `cdk init --generate-only` in a throw-away directory writes exactly the
// flags this version recommends. Best effort — an empty context is valid, just not ideal.
const syncFeatureFlags = () => {
  const cdkBinary = path.join(
    targetDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'cdk.cmd' : 'cdk',
  );
  if (!existsSync(cdkBinary)) {
    warn('aws-cdk CLI not found: cdk.json keeps an empty context');
    return;
  }

  const probeDir = mkdtempSync(path.join(tmpdir(), 'cdk-flags-'));
  try {
    const probe = run(cdkBinary, ['init', 'app', '--language', 'typescript', '--generate-only'], {
      cwd: probeDir,
      timeout: 300_000,
    });

    const probeConfig = path.join(probeDir, 'cdk.json');
    if (probe.status !== 0 || !existsSync(probeConfig)) {
      warn('could not read the recommended feature flags: cdk.json keeps an empty context');
      return;
    }

    const recommended = readJson(probeConfig).context ?? {};
    const configFile = path.join(targetDir, 'cdk.json');
    const config = readJson(configFile);
    // Anything already configured in the project wins over the recommendation.
    config.context = { ...recommended, ...(config.context ?? {}) };
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

    ok(`cdk.json: ${Object.keys(recommended).length} recommended feature flags configured`);
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
};

syncFeatureFlags();

// --- normalise formatting ----------------------------------------------------------------------
if (!values['skip-format']) {
  say('');
  say(`> ${packageManager} run format`);
  const format = run(packageManager, [...commands.run, 'format'], {
    cwd: targetDir,
    inherit: true,
    timeout: 300_000,
  });

  if (format.status !== 0) {
    warn('prettier could not format the generated files — verify-project.mjs will report why');
  }
}

say('');
say('Installed versions');
printVersions(targetDir);

const lockFile = path.join(targetDir, commands.lockFile);
say('');
if (existsSync(lockFile)) {
  ok(`lock file ${commands.lockFile} (commit it: it is what makes the project reproducible)`);
} else {
  warn(`expected ${commands.lockFile} but it is missing`);
}
