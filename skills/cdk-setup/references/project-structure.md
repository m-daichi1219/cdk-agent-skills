# Project structure, constructs and stacks

## Default structure

```text
bin/app.ts                  # entry point: environments -> stacks, cdk-nag aspect
lib/stacks/                 # deployment boundaries
lib/constructs/application/ # constructs specific to this project's domain
lib/constructs/patterns/    # reusable infrastructure patterns
lib/config/environments.ts  # deployment targets
test/stacks/
test/constructs/
```

This is a starting point, not a fixed layout. Adapt it to the user's answers — for example an
`OrderProcessing` domain gets `lib/constructs/order-processing/`.

## Do not split folders by AWS service

Avoid:

```text
lib/lambda/  lib/dynamodb/  lib/s3/  lib/cloudfront/
```

A reader cannot tell what the system does from that tree, and one logical feature ends up spread
across four folders. Split by logical responsibility, application domain, or construct boundary.

## Model with constructs, deploy with stacks

Use a custom construct when:

- the same configuration repeats,
- a security policy or project standard must be enforced in one place,
- several AWS resources together form one logical capability,
- a domain concept is worth expressing in infrastructure.

Use the L2 construct directly for a one-off simple resource. Do not wrap every L2 construct just to
save lines of code — a pass-through wrapper adds indirection without adding meaning.

Prefer L2 over L1. Reach for L1 (`Cfn*`) only when the L2 cannot express the requirement, and say so
in a comment.

## Stacks are deployment boundaries

A stack is not a code-organisation unit. Never split a stack because the file got long — extract a
construct instead.

Split stacks for: independent deployment, independent rollback, different lifecycle, different
account, different region, different ownership, blast-radius separation, CloudFormation quotas, or an
explicit architecture requirement.

Anti-pattern:

```text
ApiStack / LambdaStack / DatabaseStack   # split by technology, deployed together anyway
```

Better:

```text
ApplicationStack
├── Api construct
├── OrderProcessing construct
└── Database construct
```

Stack splitting is context-dependent: propose it, explain the boundary, and let the user decide.

## Naming

- Files: kebab-case (`application-queue.ts`).
- Classes/constructs: PascalCase (`ApplicationQueue`), props interface `<Name>Props`.
- Construct IDs: PascalCase and stable. Changing an ID replaces resources — treat any ID change to a
  stateful resource as a destructive change.
- Stack names: `<project>-<environment>`, derived from config rather than hard-coded strings.
- Prefer letting CloudFormation generate physical names. Explicit physical names block replacement
  and can collide across environments; only set them when the user needs a fixed name.

## Existing repositories

Respect what is already there: existing package manager, existing lint/format config, existing
directory conventions, existing naming. When the repository convention conflicts with this document,
the repository wins — mention the difference once, then follow it.
