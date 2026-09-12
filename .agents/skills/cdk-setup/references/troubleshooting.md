# Troubleshooting

The rule for every entry below: fix the cause, or report it. Do not delete tests, relax lint rules,
suppress cdk-nag findings, or downgrade security to reach a green pipeline.

## pnpm is not available

`corepack pnpm` may need a download, and some machines block it. Options to present:

1. `corepack enable pnpm` (needs write access to the Node.js installation),
2. install pnpm standalone (`npm install -g pnpm`, Homebrew, or the official installer),
3. run the setup with `--package-manager npm` and keep npm for the project.

Pick nothing yourself — installing or enabling a package manager changes the user's toolchain.

## A dependency's newest major breaks the toolchain

This skill installs the latest stable versions at runtime, so a new major can arrive at any time. The
known coupling points:

- `typescript-eslint` lags new TypeScript majors. `install-dependencies.mjs` therefore reads the
  installed `typescript-eslint` peer range and installs the newest TypeScript inside it. If lint
  still reports an unsupported TypeScript version, report the mismatch and propose pinning.
- `vitest` requires `vite` as a real peer dependency; both are installed explicitly.
- `cdk-nag` peers on `aws-cdk-lib`. If the peer range excludes the installed `aws-cdk-lib`, report it
  rather than forcing the install.

Record the resolved versions in the summary. `package.json` + the lock file are what make the project
reproducible afterwards.

## `format:check` fails right after generation

`install-dependencies.mjs` runs the formatter once after installing, so this should not happen. If it
does, run `<pm> run format`, inspect the diff, and check that `.prettierignore` covers `cdk.out/`,
snapshots and the lock file.

## `build` (tsc) fails in generated code

Read the error. Typical causes: a tool major bumped the TypeScript language level, or
`noUncheckedIndexedAccess` flags an index access that needs a guard. Fix the code, not the compiler
options — the strict flags are part of the golden path.

## `synth` fails with "Unable to resolve AWS account"

Something is reading `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` or doing a context lookup. The
generated app is environment-agnostic on purpose so that synth needs no credentials. Either the
config now has an account ID (fine — synth needs credentials only for lookups) or construct code is
reading the ambient environment (not fine — pass the value in through props).

## `nag` fails

Expected and useful. Do not suppress. Report each finding with rule, resource, impact, recommended
fix, alternatives, trade-offs (see `security-policy.md`) and wait for the user's decision.

If `cdk synth --strict` fails on an unrelated CDK warning (a deprecation, for example), say so
explicitly: it is a warning-as-error, not a security finding, and the fix belongs to the code that
triggers it.

## Snapshot test fails after a change

Read the diff first. Resource deletions/replacements, IAM changes and encryption changes must go to
the user before the snapshot is updated. Only update snapshots when the diff is understood and
intended: `<pm> run test -- -u`.

## The target directory is not empty

v1 targets empty or new directories. The scripts refuse to overwrite. List the conflicting files, ask
the user whether to choose another directory, remove the files themselves, or proceed selectively.
Never pass `--force` on your own initiative.

## A stack name or construct ID changed

CloudFormation identity comes from the logical ID. Renaming a construct that owns a stateful resource
replaces that resource and can destroy data. Treat it as a destructive change and report it.
