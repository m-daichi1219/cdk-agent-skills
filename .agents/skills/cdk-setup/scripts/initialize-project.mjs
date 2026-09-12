#!/usr/bin/env node
/**
 * Writes the CDK project files. Deterministic, and all-or-nothing: if any destination file already
 * exists the script reports every conflict and writes nothing.
 *
 *   node initialize-project.mjs --target infrastructure --project-name my-app \
 *     --environments dev,prod --region ap-northeast-1 --package-manager pnpm --starter none
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  ASSETS_DIR,
  MINIMUM_NODE_VERSION,
  bad,
  detectAwsRegion,
  die,
  info,
  ok,
  probeVersion,
  render,
  resolvePackageManager,
  say,
  warn,
  writeFileEnsuringDir,
} from './lib/common.mjs';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    'project-name': { type: 'string' },
    environments: { type: 'string', default: 'dev,prod' },
    region: { type: 'string' },
    'package-manager': { type: 'string', default: 'pnpm' },
    starter: { type: 'string', default: 'none' },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.target || !values['project-name']) {
  say(
    'usage: node initialize-project.mjs --target <dir> --project-name <name> ' +
      '[--environments dev,prod] [--region <region>] [--package-manager pnpm|npm|yarn] ' +
      '[--starter none|queue] [--force]',
  );
  process.exit(values.help ? 0 : 1);
}

// --- validate input --------------------------------------------------------------------------
const targetDir = path.resolve(process.cwd(), values.target);
const projectName = values['project-name'];
const packageManager = resolvePackageManager(values['package-manager']);
const starter = values.starter;

if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(projectName)) {
  die(
    `invalid project name "${projectName}": use lowercase letters, digits and hyphens ` +
      '(it becomes the npm package name and the stack name prefix)',
  );
}

if (!['none', 'queue'].includes(starter)) {
  die(`unknown starter "${starter}" (expected none or queue)`);
}

const environments = values.environments
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

if (environments.length === 0) die('at least one environment is required');
for (const name of environments) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    die(`invalid environment name "${name}": use lowercase letters, digits and hyphens`);
  }
}
if (new Set(environments).size !== environments.length) die('environment names must be unique');

const region = values.region ?? detectAwsRegion();
if (!region) {
  die(
    'no region given and none detected: pass --region (for example --region ap-northeast-1). ' +
      'Ask the user rather than guessing.',
  );
}
if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)) {
  die(`"${region}" does not look like an AWS region (expected e.g. ap-northeast-1)`);
}

const packageManagerVersion = probeVersion(packageManager, ['--version'], 180_000);
if (!packageManagerVersion) {
  die(
    `${packageManager} is not runnable. Re-run check-prerequisites.mjs and let the user choose ` +
      'how to provide it.',
  );
}

// --- template variables ----------------------------------------------------------------------
const variables = {
  PROJECT_NAME: projectName,
  PROJECT_DIR: path.relative(process.cwd(), targetDir) || '.',
  PM: packageManager,
  PACKAGE_MANAGER: `${packageManager}@${packageManagerVersion}`,
  NODE_ENGINE: `>=${MINIMUM_NODE_VERSION}`,
  REGION: region,
  DEFAULT_ENVIRONMENT: environments[0],
  ENVIRONMENT_LIST: environments.join(', '),
  ENVIRONMENT_ENTRIES: environments
    .map(
      (name) =>
        `  ${name}: {\n` +
        `    // Fill in the AWS account ID when this environment is ready to deploy.\n` +
        `    account: undefined,\n` +
        `    region: '${region}',\n` +
        `  },`,
    )
    .join('\n'),
};

// --- file plan -------------------------------------------------------------------------------
const commonFiles = [
  ['project/package.json.tmpl', 'package.json'],
  ['project/tsconfig.json.tmpl', 'tsconfig.json'],
  ['project/cdk.json.tmpl', 'cdk.json'],
  // .mts so the ESM config is not loaded as CommonJS (vite warns about that).
  ['project/vitest.config.mts.tmpl', 'vitest.config.mts'],
  ['project/eslint.config.mjs.tmpl', 'eslint.config.mjs'],
  ['project/prettier.config.mjs.tmpl', 'prettier.config.mjs'],
  ['project/prettierignore.tmpl', '.prettierignore'],
  ['project/gitignore.tmpl', '.gitignore'],
  ['project/README.md.tmpl', 'README.md'],
  ['project/bin/app.ts.tmpl', 'bin/app.ts'],
  ['project/lib/app.ts.tmpl', 'lib/app.ts'],
  ['project/lib/config/environments.ts.tmpl', 'lib/config/environments.ts'],
  ['project/lib/constructs/application/README.md.tmpl', 'lib/constructs/application/README.md'],
  ['project/lib/constructs/patterns/README.md.tmpl', 'lib/constructs/patterns/README.md'],
  ['project/test/app.test.ts.tmpl', 'test/app.test.ts'],
];

const starterFiles = {
  none: [
    ['starters/none/lib/stacks/application-stack.ts.tmpl', 'lib/stacks/application-stack.ts'],
    [
      'starters/none/test/stacks/application-stack.test.ts.tmpl',
      'test/stacks/application-stack.test.ts',
    ],
  ],
  queue: [
    ['starters/queue/lib/stacks/application-stack.ts.tmpl', 'lib/stacks/application-stack.ts'],
    [
      'starters/queue/lib/constructs/application/application-queue.ts.tmpl',
      'lib/constructs/application/application-queue.ts',
    ],
    [
      'starters/queue/test/stacks/application-stack.test.ts.tmpl',
      'test/stacks/application-stack.test.ts',
    ],
    [
      'starters/queue/test/constructs/application-queue.test.ts.tmpl',
      'test/constructs/application-queue.test.ts',
    ],
  ],
};

const plan = [...commonFiles, ...starterFiles[starter]].map(([template, destination]) => ({
  template: path.join(ASSETS_DIR, template),
  destination: path.join(targetDir, destination),
  relative: destination,
}));

for (const entry of plan) {
  if (!existsSync(entry.template)) die(`missing template asset: ${entry.template}`);
}

const conflicts = plan.filter((entry) => existsSync(entry.destination));
if (conflicts.length > 0 && !values.force) {
  say('These files already exist and will not be overwritten:');
  conflicts.forEach((entry) => bad(entry.relative));
  die(
    'nothing was written. Ask the user how to proceed (different directory, remove the files, or ' +
      'selective generation). Do not pass --force on your own initiative.',
  );
}

// --- write -----------------------------------------------------------------------------------
say(`Generating ${projectName} in ${targetDir}`);
say('');

for (const entry of plan) {
  const contents = render(readFileSync(entry.template, 'utf8'), variables);
  writeFileEnsuringDir(entry.destination, contents);
  ok(entry.relative);
}

if (conflicts.length > 0) {
  say('');
  warn(`--force overwrote ${conflicts.length} existing file(s)`);
}

// --- pnpm build-script approval ----------------------------------------------------------------
// pnpm does not run dependency install scripts unless they are approved, and pnpm >= 12 turns an
// unapproved one into an install error. `esbuild` (pulled in by vite) is the only one the toolchain
// installed here needs, so approve exactly that — in a committed file the user can audit. Anything
// else that asks for a build script is a supply-chain decision for the user, not a default.
if (packageManager === 'pnpm') {
  const pnpmMajor = Number.parseInt(packageManagerVersion.split('.')[0], 10);
  const settingsFile = path.join(targetDir, 'pnpm-workspace.yaml');

  if (pnpmMajor >= 12) {
    if (!existsSync(settingsFile) || values.force) {
      writeFileEnsuringDir(
        settingsFile,
        '# Dependency install scripts that are allowed to run. Add an entry only after you have\n' +
          '# decided that running that package\'s code during install is acceptable.\n' +
          'allowBuilds:\n  esbuild: true\n',
      );
      ok('pnpm-workspace.yaml');
    } else {
      warn('pnpm-workspace.yaml exists — check that esbuild is allowed to run its install script');
    }
  } else {
    // pnpm 10/11 read the allow-list from package.json and only warn about ignored builds.
    const manifestFile = path.join(targetDir, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    manifest.pnpm = { ...manifest.pnpm, onlyBuiltDependencies: ['esbuild'] };
    writeFileEnsuringDir(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    ok('package.json (pnpm.onlyBuiltDependencies)');
  }
}

say('');
info(`package manager   ${variables.PACKAGE_MANAGER}`);
info(`environments      ${variables.ENVIRONMENT_LIST} (region ${region}, accounts unset)`);
info(`starter           ${starter}`);
say('');
say(`Next: node ${path.join('scripts', 'install-dependencies.mjs')} --target ${values.target} --package-manager ${packageManager}`);
