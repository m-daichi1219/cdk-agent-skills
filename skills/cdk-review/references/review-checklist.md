# CDK review checklist

Work top to bottom. Everything you cannot verify locally becomes a question, not an assumption.

## Pipeline

- [ ] `format:check`, `lint`, `build`, `test`, `synth`, `nag` — real results, each one recorded
- [ ] test count and snapshot updates in this change reviewed, none skipped or deleted
- [ ] lock file present and consistent with `package.json`

## Destructive change (blocking)

- [ ] `cdk diff` shows no unintended deletion or replacement
- [ ] no construct ID / stack name change on a resource that holds data
- [ ] no physical name change, no key-schema change, no engine/instance-class replacement
- [ ] removal policy on stateful resources still `RETAIN` (or changed deliberately, per environment)
- [ ] deletion protection still in place where the project wants it
- [ ] resources moved between stacks are handled as a migration, not a rename

## Security (blocking when exposed or exposable)

- [ ] no secrets, access keys, tokens, account IDs or profile names in code, config or tests
- [ ] no public access that was not explicitly requested: buckets, security groups (`0.0.0.0/0`),
      API auth `NONE`, public subnets for private workloads, publicly accessible databases
- [ ] encryption at rest and in transit; TLS enforced where the service supports it
- [ ] logging/auditing enabled where the project expects it, retention set explicitly
- [ ] no `process.env` / `CDK_DEFAULT_ACCOUNT` inside construct code

## IAM

- [ ] `grant*` API used before service-specific API, before explicit `PolicyStatement`
- [ ] no `Action: '*'`, no `Resource: '*'`, no `AdministratorAccess`, no broad managed policies
- [ ] every wildcard has a written justification the user accepted
- [ ] one role per workload, scoped to the resources it actually uses
- [ ] no new trust relationship (cross-account, cross-service) without user confirmation
- [ ] KMS key policies and grants reviewed when an encrypted resource is shared

## cdk-nag

- [ ] `AwsSolutionsChecks` runs in the pipeline
- [ ] every finding reported with rule, resource, impact, fix, alternatives, trade-offs
- [ ] no new acknowledgement (`Validations.of(...).acknowledge`, or `NagSuppressions` on cdk-nag v2)
      without: reason, accepted risk, minimal scope, user agreement
- [ ] no acknowledgement placed on a stack or app scope, where it also absorbs future violations
- [ ] existing acknowledgements still valid — a stale one hides a real finding

## Design

- [ ] stacks are deployment boundaries, not code-organisation units
- [ ] complexity lives in constructs; stacks read as wiring
- [ ] folders follow domain/responsibility, not AWS service
- [ ] constructs earn their existence (repeated config, enforced standard, one logical capability)
- [ ] props have safe defaults, documented, and validated where they have invariants
- [ ] L1 escape hatches are commented and asserted
- [ ] environment-specific values come from config through props

## Tests

- [ ] one snapshot test per stack, committed
- [ ] fine-grained assertions for loops, conditionals, props-driven values, overrides
- [ ] fine-grained assertions for security properties (encryption, retention, public access, TLS)
- [ ] IAM assertions on the action sets that matter
- [ ] no assertions on generated logical IDs or asset hashes
- [ ] no test needs credentials or network

## Operations

- [ ] tags applied consistently (project, environment, owner as the repository requires)
- [ ] alarms/dashboards where the project expects them
- [ ] cost-relevant choices visible: instance sizes, provisioned capacity, NAT gateways, log
      retention, cross-AZ traffic
- [ ] bootstrap requirement for a new account/region mentioned, with the command for the user

## Report

- [ ] findings grouped Blocking / Should fix / Consider, each with location
- [ ] every finding has a recommended fix, alternatives and trade-offs
- [ ] questions the user must answer listed explicitly
- [ ] deployment commands handed to the user, never executed
