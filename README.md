# cdk-agent-skills

Agent Skills for safe, consistent AWS CDK development.

Three skills, following the [Agent Skills specification](https://agentskills.io/specification), so
they work in GitHub Copilot (cloud agent, CLI, code review, VS Code, JetBrains, Visual Studio),
Cursor, Claude Code and other agents that read `SKILL.md`.

| Skill | Purpose |
| --- | --- |
| [`cdk-setup`](.agents/skills/cdk-setup) | Build a TypeScript AWS CDK v2 project: pnpm, ESLint, Prettier, Vitest + CDK Assertions, cdk-nag, repository instructions |
| [`cdk-development`](.agents/skills/cdk-development) | Implement CDK infrastructure: construct/stack design, least-privilege IAM, tests |
| [`cdk-review`](.agents/skills/cdk-review) | Review quality, security, IAM, generated template, destructive change |

## Philosophy

**Golden Path + Escape Hatch.** The skills provide one safe, opinionated route for AWS CDK work. They
never forbid leaving it — but the agent does not leave it on its own.

Every decision falls into one of four buckets:

- **Guardrail** — the agent must not change it (no deploys, no secrets, no silent cdk-nag
  suppression, no destructive change).
- **Golden default** — the agent may assume it (TypeScript, CDK v2, pnpm, ESLint, Prettier, Vitest,
  CDK Assertions, cdk-nag, L2-first).
- **Context dependent** — only the user decides (removal policy, retention, public access, VPC
  placement, CMK strategy, stack boundaries, IAM expansion, how to resolve a cdk-nag finding).
- **Automatically detectable** — the agent detects it and does not ask (Node.js version, package
  manager, lock file, git root, AWS CLI, repository layout).

## Install into a repository

Project skills are read from `.agents/skills/` (also `.github/skills/` or `.claude/skills/`).

```bash
# whole set
git clone https://github.com/daichi/cdk-agent-skills /tmp/cdk-agent-skills
mkdir -p .agents/skills
cp -R /tmp/cdk-agent-skills/.agents/skills/cdk-setup .agents/skills/

# or, with GitHub CLI (>= 2.9x)
gh skill install daichi/cdk-agent-skills
```

Then ask your agent to set up a CDK project — it loads `cdk-setup` from the description. `cdk-setup`
installs `cdk-development` and `cdk-review` into the target repository itself, writes
`.github/copilot-instructions.md`, and records what it installed in
`.agents/skills/installed-skills.json`:

```json
{
  "generatedBy": "cdk-setup",
  "generatedByVersion": "1.0.0",
  "cdkProjectDir": "infrastructure",
  "skills": [
    { "name": "cdk-development", "version": "1.0.0" },
    { "name": "cdk-review", "version": "1.0.0" }
  ]
}
```

Personal (cross-project) installation works too: copy a skill into `~/.agents/skills/` or
`~/.copilot/skills/`.

## What `cdk-setup` produces

```text
<repo>/
├── .agents/skills/{cdk-development,cdk-review}/
├── .github/copilot-instructions.md
└── <cdk-dir>/                      # ".", "cdk", "infrastructure", … you choose
    ├── bin/app.ts                  # thin entry point
    ├── lib/app.ts                  # one stack per environment + cdk-nag aspect
    ├── lib/config/environments.ts  # deployment targets, never credentials
    ├── lib/stacks/ lib/constructs/
    ├── test/                       # snapshot + fine-grained assertions
    └── package.json cdk.json tsconfig.json vitest.config.ts eslint.config.mjs …
```

One validation entry point, no AWS account required:

```bash
pnpm check   # format:check -> lint -> build -> test -> synth -> nag
```

`deploy`, `destroy` and `bootstrap` are human actions. The skills print the commands; they never run
them.

## Versioning

Each skill carries `metadata.version` in its `SKILL.md` frontmatter and follows Semantic Versioning:
a breaking change to the generated project layout or to a script's interface is a major bump.

Dependency versions are *not* pinned in the skill. `install-dependencies.mjs` resolves the latest
stable versions at run time (with TypeScript constrained to what the installed `typescript-eslint`
supports) and the generated `package.json` + lock file make the project reproducible from then on.

## Development

```bash
# regenerate the reference project the way an agent would, then validate it
node .agents/skills/cdk-setup/scripts/check-prerequisites.mjs --target /tmp/selftest/infrastructure
node .agents/skills/cdk-setup/scripts/initialize-project.mjs --target /tmp/selftest/infrastructure \
  --project-name selftest-app --environments dev,prod --region ap-northeast-1 --starter none
node .agents/skills/cdk-setup/scripts/install-dependencies.mjs --target /tmp/selftest/infrastructure
node .agents/skills/cdk-setup/scripts/verify-project.mjs --target /tmp/selftest/infrastructure
```

Self-tests must stay local and deterministic: `synth` and `diff` are allowed, `deploy`, `destroy` and
`bootstrap` never are.

`instructions.md` holds the design requirements this repository implements.

## License

MIT
