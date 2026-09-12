#!/usr/bin/env node
/**
 * Runs the validation pipeline and prints a result table.
 *
 * Order is cheapest-feedback-first: format:check -> lint -> build -> test -> synth -> nag.
 * Setup is only complete when lint, test, synth and nag pass. Nothing here touches AWS.
 *
 *   node verify-project.mjs --target infrastructure --package-manager pnpm
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  PACKAGE_MANAGERS,
  bad,
  die,
  info,
  ok,
  printVersions,
  resolvePackageManager,
  run,
  say,
  warn,
} from './lib/common.mjs';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    'package-manager': { type: 'string', default: 'pnpm' },
    'fail-fast': { type: 'boolean', default: false },
    only: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help || !values.target) {
  say(
    'usage: node verify-project.mjs --target <dir> [--package-manager pnpm|npm|yarn] ' +
      '[--fail-fast] [--only lint,test]',
  );
  process.exit(values.help ? 0 : 1);
}

const targetDir = path.resolve(process.cwd(), values.target);
const packageManager = resolvePackageManager(values['package-manager']);
const commands = PACKAGE_MANAGERS[packageManager];

if (!existsSync(path.join(targetDir, 'node_modules'))) {
  die(`${targetDir} has no node_modules — run install-dependencies.mjs first`);
}

const allSteps = ['format:check', 'lint', 'build', 'test', 'synth', 'nag'];
const steps = values.only
  ? values.only
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
  : allSteps;

for (const step of steps) {
  if (!allSteps.includes(step)) die(`unknown step "${step}" (expected one of ${allSteps.join(', ')})`);
}

/** True when no snapshot has been recorded yet, i.e. this is the first test run. */
const hasSnapshots = (() => {
  const walk = (directory) => {
    if (!existsSync(directory)) return false;
    return readdirSync(directory).some((entry) => {
      const candidate = path.join(directory, entry);
      if (statSync(candidate).isDirectory()) return walk(candidate);
      return entry.endsWith('.snap');
    });
  };
  return walk(path.join(targetDir, 'test'));
})();

const results = [];

const execute = (step) => {
  const args = [...commands.run, step];
  // The very first test run has nothing to compare against; record the baseline explicitly
  // instead of letting a CI environment fail on a missing snapshot file.
  const creatingSnapshots = step === 'test' && !hasSnapshots;
  if (creatingSnapshots) args.push('--', '--update');

  say('');
  say(`> ${packageManager} ${args.join(' ')}${creatingSnapshots ? '   (recording baseline snapshots)' : ''}`);

  const result = run(packageManager, args, { cwd: targetDir, inherit: true, timeout: 1_800_000 });
  results.push({ step, passed: result.status === 0, creatingSnapshots });

  return result.status === 0;
};

for (const step of steps) {
  const passed = execute(step);
  if (!passed && values['fail-fast']) break;
}

// --- report ------------------------------------------------------------------------------------
say('');
say('Validation');
for (const { step, passed, creatingSnapshots } of results) {
  const label = `${step.padEnd(13)} ${passed ? 'PASS' : 'FAIL'}`;
  if (passed) {
    ok(creatingSnapshots ? `${label}   (baseline snapshots written — commit them)` : label);
  } else {
    bad(label);
  }
}

const skipped = steps.filter((step) => !results.some((result) => result.step === step));
for (const step of skipped) info(`${step.padEnd(13)} SKIPPED (earlier step failed)`);

say('');
say('Versions');
printVersions(targetDir);

const failed = results.filter((result) => !result.passed).map((result) => result.step);
const required = ['lint', 'test', 'synth', 'nag'];

say('');
if (failed.length === 0) {
  ok('all validation steps passed');
  process.exit(0);
}

bad(`failed: ${failed.join(', ')}`);
if (failed.some((step) => required.includes(step))) {
  warn('setup is NOT complete: lint, test, synth and nag must pass');
}
warn(
  'report the real failure. Do not delete tests, relax rules, suppress cdk-nag findings or ' +
    'weaken security defaults to get a green pipeline.',
);
process.exit(1);
