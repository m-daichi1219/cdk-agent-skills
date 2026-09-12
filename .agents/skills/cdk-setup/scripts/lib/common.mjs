/**
 * Shared helpers for the cdk-setup scripts.
 *
 * Deliberately dependency-free: these scripts run before anything is installed, and they must work
 * on macOS, Linux and Windows with nothing but a Node.js runtime.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory of the skill (the parent of `scripts/`). */
export const SKILL_DIR = path.resolve(fileURLToPath(import.meta.url), '../../..');
export const ASSETS_DIR = path.join(SKILL_DIR, 'assets');

/** Vitest 5 needs >= 22.12; ESLint 10 needs >= 20.19. Take the stricter bound. */
export const MINIMUM_NODE_VERSION = '22.12.0';

export const PACKAGE_MANAGERS = {
  pnpm: {
    addProd: ['add'],
    addDev: ['add', '--save-dev'],
    install: ['install'],
    run: ['run'],
    lockFile: 'pnpm-lock.yaml',
  },
  npm: {
    addProd: ['install', '--save'],
    addDev: ['install', '--save-dev'],
    install: ['install'],
    run: ['run'],
    lockFile: 'package-lock.json',
  },
  yarn: {
    addProd: ['add'],
    addDev: ['add', '--dev'],
    install: ['install'],
    run: ['run'],
    lockFile: 'yarn.lock',
  },
};

export const say = (message = '') => console.log(message);
export const ok = (message) => console.log(`  ok     ${message}`);
export const info = (message) => console.log(`  info   ${message}`);
export const warn = (message) => console.log(`  warn   ${message}`);
export const bad = (message) => console.log(`  FAIL   ${message}`);

export const die = (message, code = 1) => {
  console.error(`\nerror: ${message}`);
  process.exit(code);
};

/**
 * Runs a command without a shell (except on Windows, where npm/pnpm are `.cmd` shims).
 * Never throws: callers decide what a non-zero status means.
 */
export const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeout ?? 0,
    stdio: options.inherit ? 'inherit' : 'pipe',
    env: { ...process.env, ...(options.env ?? {}) },
    shell: process.platform === 'win32',
  });

  return {
    status: result.error ? -1 : (result.status ?? -1),
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
    error: result.error,
  };
};

/** Returns the version a command reports, or null when it is unavailable. */
export const probeVersion = (command, args = ['--version'], timeout = 60_000) => {
  const result = run(command, args, { timeout });
  if (result.status !== 0) return null;

  const match = /\d+\.\d+\.\d+[^\s]*/.exec(`${result.stdout}\n${result.stderr}`);
  return match ? match[0] : result.stdout.split('\n')[0];
};

/** Numeric semver comparison, prerelease tags ignored. */
export const compareVersions = (left, right) => {
  const parse = (value) =>
    String(value)
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);

  const a = parse(left);
  const b = parse(right);

  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
};

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** Replaces `{{KEY}}` placeholders and refuses to emit a file with an unresolved one. */
export const render = (source, variables) => {
  const rendered = source.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (!(key in variables)) throw new Error(`template uses unknown variable ${match}`);
    return String(variables[key]);
  });

  const leftover = /\{\{[A-Z0-9_]+\}\}/.exec(rendered);
  if (leftover) throw new Error(`unresolved template variable ${leftover[0]}`);

  return rendered;
};

export const writeFileEnsuringDir = (file, contents) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents, 'utf8');
};

export const copyDirectory = (source, destination) => {
  cpSync(source, destination, { recursive: true });
};

export const isDirectoryEmpty = (directory) => {
  if (!existsSync(directory)) return true;
  return readdirSync(directory).filter((entry) => entry !== '.git').length === 0;
};

/** Git repository root for `startDir`, or null when it is not a repository. */
export const findRepositoryRoot = (startDir) => {
  const result = run('git', ['rev-parse', '--show-toplevel'], { cwd: startDir, timeout: 20_000 });
  return result.status === 0 && result.stdout ? result.stdout : null;
};

/** Region from the environment or the AWS CLI config, or null when nothing is configured. */
export const detectAwsRegion = () => {
  const fromEnvironment = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  if (fromEnvironment) return fromEnvironment;

  const result = run('aws', ['configure', 'get', 'region'], { timeout: 20_000 });
  return result.status === 0 && result.stdout ? result.stdout : null;
};

/** Installed version of a dependency in the target project, or null. */
export const installedVersion = (targetDir, packageName) => {
  const manifest = path.join(targetDir, 'node_modules', ...packageName.split('/'), 'package.json');
  if (!existsSync(manifest)) return null;

  try {
    return readJson(manifest).version ?? null;
  } catch {
    return null;
  }
};

export const REPORTED_PACKAGES = [
  'aws-cdk-lib',
  'aws-cdk',
  'constructs',
  'cdk-nag',
  'typescript',
  'vitest',
  'eslint',
  'typescript-eslint',
  'prettier',
  'tsx',
];

export const collectVersions = (targetDir) =>
  REPORTED_PACKAGES.map((name) => [name, installedVersion(targetDir, name)]);

export const printVersions = (targetDir) => {
  for (const [name, version] of collectVersions(targetDir)) {
    info(`${name.padEnd(18)} ${version ?? 'not installed'}`);
  }
};

export const resolvePackageManager = (value) => {
  const name = value ?? 'pnpm';
  if (!(name in PACKAGE_MANAGERS)) {
    die(`unsupported package manager "${name}" (expected pnpm, npm or yarn)`);
  }
  return name;
};
