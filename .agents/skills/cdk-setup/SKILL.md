---
name: cdk-setup
description: Create a production-quality TypeScript AWS CDK v2 project with pnpm, ESLint, Prettier, Vitest + CDK Assertions (snapshot and fine-grained) and cdk-nag, in a repository root or a subdirectory such as cdk/ or infrastructure/. Use when the user asks to set up, scaffold, bootstrap, initialize or add an AWS CDK project, or to add CDK lint/format/test/synth/cdk-nag validation to a repository.
license: MIT
compatibility: Requires Node.js >= 22.12 (LTS line recommended) and npm-registry network access. Runs pnpm/npm, tsc, eslint, prettier, vitest and `cdk synth` locally. Never needs AWS credentials and never calls AWS mutating APIs.
metadata:
  version: "1.0.0"
  repository: https://github.com/daichi/cdk-agent-skills
---

# cdk-setup

Build a safe, consistent, reproducible TypeScript AWS CDK v2 development environment.

Philosophy: **Golden Path + Escape Hatch.** You provide the standard safe route. The user owns every
project-specific decision.

## Scope

In scope: prerequisite checks, target directory selection, project generation, dependency
installation, lint/format/test/synth/cdk-nag configuration, companion skill installation, repository
instructions, validation, summary.

Out of scope: implementing the user's application architecture (that is `cdk-development`), reviewing
existing code (that is `cdk-review`), and anything that mutates an AWS environment.

v1 assumes the target directory is empty or newly created. Do not migrate an existing CDK project
with this skill; if the target already contains a CDK project, stop and report.

## Guardrails — never violate

1. Never run `cdk deploy`, `cdk destroy`, `cdk bootstrap`, `aws cloudformation deploy`, or any other
   command that mutates an AWS account. Print the command for the user instead.
2. Never overwrite existing files without explicit user approval. The scripts refuse by default;
   do not pass `--force` on your own initiative.
3. Never suppress or acknowledge a `cdk-nag` finding, and never weaken a security default, to make
   validation pass. Report findings with the template in `references/security-policy.md` and wait.
4. Never write secrets, account IDs the user did not give you, AWS profile names, or credentials into
   source code.
5. Never decide context-dependent items yourself (removal policy, public access, VPC placement,
   encryption key strategy, stack splitting, IAM expansion). Ask, with options and trade-offs.
6. Never hide a validation failure and never work around it just to reach a green pipeline.
7. Never install global packages or modify the user's shell/toolchain without asking.

## Workflow

Run the steps in order. Every script is dependency-free Node.js (`node <script> --help`).
`SKILL_DIR` below is the directory containing this file.

### Step 1 — Detect the environment (no questions yet)

```bash
node "$SKILL_DIR/scripts/check-prerequisites.mjs" --target <target-dir>
```

It reports Node.js/package-manager/git/AWS CLI availability, the git repository root, and whether the
target directory is empty. Use `--json` if you want to parse it.

Do not ask the user anything that this script already answered (§ Automatically Detectable). If it
exits non-zero, fix the reported blocker first — typically an unsupported Node.js version or a
missing package manager. If pnpm is missing, present the options (enable it via
`corepack enable pnpm`, install it, or fall back to npm) and let the user choose.

### Step 2 — Minimal interview

Ask only what you cannot detect, in one message, with defaults pre-filled:

| Question | Default |
| --- | --- |
| Where should the CDK project live? (`.`, `cdk`, `infrastructure`) | `.` if the repository is empty, otherwise `infrastructure` |
| Project name (used for stack names and resource naming) | directory or repository name, kebab-case |
| What will this project mainly do? Which AWS resources do you expect? | no default — shapes the structure and the follow-up work |
| Which deployment environments? (`dev,prod`, `dev,stg,prod`, …) | `dev,prod` |
| Empty stack, or include the example queue construct? | empty (`--starter none`); example is `--starter queue` |

Notes:

- Do not ask for AWS account IDs. Accounts stay unset (environment-agnostic stacks) until the user
  fills them in `lib/config/environments.ts`. See `references/environment-policy.md`.
- Region: use the detected `AWS_REGION`/`AWS_DEFAULT_REGION`/CLI profile region when present,
  otherwise ask once.
- Do not invent preset sizes (small/standard/large) and do not ask about tooling versions.
- Do not ask questions for work that is not part of this setup.

### Step 3 — Generate the project

```bash
node "$SKILL_DIR/scripts/initialize-project.mjs" \
  --target <target-dir> \
  --project-name <name> \
  --environments dev,prod \
  --region <region> \
  --package-manager pnpm \
  --starter none
```

The script creates the directory when needed, writes the template files, and refuses to touch files
that already exist (it lists them and exits non-zero). Read
`references/project-structure.md` before adapting the structure to the user's answers.

### Step 4 — Install dependencies

```bash
node "$SKILL_DIR/scripts/install-dependencies.mjs" --target <target-dir> --package-manager pnpm
```

Installs the latest stable versions available at runtime, resolves TypeScript to the newest version
that the installed `typescript-eslint` actually supports, copies the feature flags the installed CDK
version recommends into `cdk.json`, writes the lock file, and formats the generated sources. It
prints the resolved version table — include it in your summary.

A cold cache on a slow connection can take several minutes; the script has no timeout on purpose.

### Step 5 — Install the companion skills and repository instructions

```bash
node "$SKILL_DIR/scripts/install-skills.mjs" --repo-root <repo-root> --target <target-dir> \
  --project-name <name> --package-manager pnpm
```

`--repo-root` defaults to the git root of the target, so it can usually be omitted.

Copies `cdk-development` and `cdk-review` into `<repo-root>/.agents/skills/`, writes
`.github/copilot-instructions.md` (skipped if one exists — then propose a merge to the user), and
records `<repo-root>/.agents/skills/installed-skills.json` for version tracking.

### Step 6 — Validate

```bash
node "$SKILL_DIR/scripts/verify-project.mjs" --target <target-dir> --package-manager pnpm
```

Runs, in fail-fast-friendly order: `format:check` → `lint` → `build` → `test` → `synth` → `nag`.
Setup is complete only when `lint`, `test`, `synth` and `nag` pass; aim for the whole pipeline green.

If something fails:

- Report the real error. Never delete a test, relax a rule, or suppress a finding to pass.
- Tooling/config problems (a new major of a tool, a type error in generated code): fix properly.
- cdk-nag findings: use the reporting template and ask the user how to proceed.

### Step 7 — Report

Present the summary using the template in `references/summary-template.md`: environment and resolved
versions, generated files, validation results, design decisions, known limitations, and the exact
next commands **for the user to run** (`cdk bootstrap` / `cdk deploy` are theirs, never yours).

Then stop. Do not start implementing application infrastructure unless the user asks; that work
belongs to `cdk-development`.

## What the generated project gives you

```text
<target>/
├── bin/app.ts                                  # Thin entry point
├── lib/
│   ├── app.ts                                  # One stack per environment + cdk-nag registration
│   ├── config/environments.ts                  # Deployment targets (account/region), no credentials
│   ├── constructs/application/                 # Domain constructs (`application-queue.ts` if --starter queue)
│   ├── constructs/patterns/                    # Reusable infrastructure patterns
│   └── stacks/application-stack.ts             # Deployment boundary (empty unless --starter queue)
├── test/
│   ├── stacks/                                 # Snapshot + fine-grained assertions
│   └── constructs/
├── cdk.json  tsconfig.json  vitest.config.mts
├── eslint.config.mjs  prettier.config.mjs  .prettierignore
├── package.json  .gitignore  README.md
└── pnpm-workspace.yaml                         # pnpm only: install scripts that may run
```

`bin/app.ts` runs through `tsx` (`cdk.json` → `node --import tsx bin/app.ts`). cdk-nag v3 is a CDK
policy validation plugin, attached only when `--context nag=true` is passed, and `nag` runs
`cdk synth --strict` so warning-level rules fail too.

Scripts: `format`, `format:check`, `lint`, `lint:fix`, `build`, `test`, `test:watch`, `synth`, `nag`,
`diff`, `check`, `deploy` (user-only).

## References

Read these when the task touches them; do not paste them wholesale into your answer.

- `references/project-structure.md` — structure, construct and stack design rules
- `references/testing-policy.md` — snapshot vs fine-grained assertions
- `references/security-policy.md` — security defaults, IAM ladder, cdk-nag finding/suppression policy
- `references/environment-policy.md` — deployment targets vs credentials, bootstrap, deployment
- `references/summary-template.md` — the report format for step 7
- `references/troubleshooting.md` — known failure modes and the correct fixes
