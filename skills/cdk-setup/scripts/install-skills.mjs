#!/usr/bin/env node
/**
 * Makes the companion skills and the repository instructions available in the target repository.
 *
 * Nothing existing is overwritten: an already installed skill or an existing
 * `.github/copilot-instructions.md` is reported and left alone, so a human decides how to merge.
 *
 *   node install-skills.mjs --repo-root . --target infrastructure --project-name my-app
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  ASSETS_DIR,
  SKILL_DIR,
  copyDirectory,
  die,
  findRepositoryRoot,
  info,
  ok,
  render,
  resolvePackageManager,
  say,
  warn,
  writeFileEnsuringDir,
} from './lib/common.mjs';

const { values } = parseArgs({
  options: {
    'repo-root': { type: 'string' },
    target: { type: 'string', default: '.' },
    'project-name': { type: 'string' },
    'package-manager': { type: 'string', default: 'pnpm' },
    skills: { type: 'string', default: 'cdk-development,cdk-review' },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  say(
    'usage: node install-skills.mjs [--repo-root <dir>] --target <cdk-dir> ' +
      '--project-name <name> [--package-manager pnpm|npm|yarn] [--skills a,b] [--force]',
  );
  process.exit(0);
}

const targetDir = path.resolve(process.cwd(), values.target);
const repoRoot = path.resolve(
  process.cwd(),
  values['repo-root'] ?? findRepositoryRoot(targetDir) ?? targetDir,
);
const packageManager = resolvePackageManager(values['package-manager']);
const projectName = values['project-name'] ?? path.basename(targetDir);

/** Sibling skills in this source repo (`skills/`). Destination is the consumer path. */
const sourceSkillsRoot = path.dirname(SKILL_DIR);
const destinationSkillsRoot = path.join(repoRoot, '.agents', 'skills');

const readSkillVersion = (skillDir) => {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!existsSync(skillFile)) return null;

  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(skillFile, 'utf8'));
  if (!frontmatter) return null;

  const version = /^\s+version:\s*"?([^"\n]+)"?\s*$/m.exec(frontmatter[1]);
  return version ? version[1].trim() : null;
};

say(`Installing skills into ${path.relative(process.cwd(), destinationSkillsRoot) || '.'}`);
say('');

const requested = values.skills
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const installed = [];

for (const name of requested) {
  const source = path.join(sourceSkillsRoot, name);
  const destination = path.join(destinationSkillsRoot, name);

  if (!existsSync(source)) {
    warn(`${name}: not found next to cdk-setup (${source}) — report this, do not fabricate it`);
    continue;
  }

  if (path.resolve(source) === path.resolve(destination)) {
    ok(`${name}: already in place (skill source is this repository)`);
  } else if (existsSync(destination) && !values.force) {
    warn(`${name}: already installed — left untouched (compare versions before replacing)`);
  } else {
    copyDirectory(source, destination);
    ok(`${name}: installed`);
  }

  installed.push({ name, version: readSkillVersion(source), source });
}

// --- repository instructions -------------------------------------------------------------------
const instructionsFile = path.join(repoRoot, '.github', 'copilot-instructions.md');
const instructionsTemplate = path.join(ASSETS_DIR, 'repo', 'copilot-instructions.md.tmpl');

if (!existsSync(instructionsTemplate)) die(`missing template asset: ${instructionsTemplate}`);

if (existsSync(instructionsFile) && !values.force) {
  warn(
    '.github/copilot-instructions.md exists — left untouched. Propose a merge of the always-on ' +
      `principles from ${path.relative(process.cwd(), instructionsTemplate)} to the user.`,
  );
} else {
  writeFileEnsuringDir(
    instructionsFile,
    render(readFileSync(instructionsTemplate, 'utf8'), {
      PROJECT_NAME: projectName,
      PROJECT_DIR: path.relative(repoRoot, targetDir) || '.',
      PM: packageManager,
    }),
  );
  ok('.github/copilot-instructions.md');
}

// --- manifest ----------------------------------------------------------------------------------
// Lets a human tell which version of the skill set a repository is running.
const manifest = {
  generatedBy: 'cdk-setup',
  generatedByVersion: readSkillVersion(SKILL_DIR),
  installedAt: new Date().toISOString(),
  cdkProjectDir: path.relative(repoRoot, targetDir) || '.',
  skills: installed.map(({ name, version }) => ({ name, version })),
};

writeFileEnsuringDir(
  path.join(destinationSkillsRoot, 'installed-skills.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
ok('.agents/skills/installed-skills.json');

say('');
for (const { name, version } of installed) {
  info(`${name.padEnd(18)} ${version ?? 'version unknown'}`);
}
