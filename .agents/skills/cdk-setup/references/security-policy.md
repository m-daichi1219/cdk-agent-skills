# Security policy

Baseline: **AWS recommended practices + explicit project guardrails.** Generating a lot of
infrastructure with AI is fine; deciding the project's risk posture on the user's behalf is not.

## Secure defaults

Prefer, unless the user explicitly decides otherwise:

- private resources; no public access unless the requirement is explicit,
- encryption at rest and in transit enabled,
- least-privilege IAM,
- logging/auditing enabled where it is cheap and useful,
- managed secret services (Secrets Manager / SSM SecureString), never literals in code,
- the L2 construct's secure defaults — do not override them to silence a tool.

Context-dependent, so always ask: removal policy, retention periods, customer-managed key strategy,
public exposure, VPC placement, cross-account access, stack boundaries, IAM scope expansion.

## IAM ladder

Work down this list and stop at the first rung that satisfies the requirement:

1. L2 `grant*` API — `bucket.grantRead(handler)`
2. service-specific API — `queue.grantConsumeMessages(handler)`
3. explicit `PolicyStatement` with concrete actions and ARNs
4. wildcards — only with a written justification the user accepted

Never generate `Action: '*'`, `Resource: '*'`, `AdministratorAccess`, or broad managed policies as a
convenience. If a wildcard is genuinely unavoidable (for example an action that does not support
resource-level permissions), say which action, why, and how the scope is bounded.

## cdk-nag

`AwsSolutionsChecks` runs through `pnpm nag`. Treat security validation strictly.

cdk-nag v3 is a CDK **policy validation plugin**, not an Aspect: it is registered with
`Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }))`. (v2 used
`Aspects.of(app).add(...)` and `NagSuppressions`; both are gone in v3.)

Rules report at ERROR or WARNING level. The `nag` script runs `cdk synth --strict`, which fails on
warnings too — otherwise a warning-level rule such as `AwsSolutions-DDB3` (missing point-in-time
recovery) would pass silently.

When a finding appears, **do not fix it silently and do not suppress it.** Report it:

```text
Rule:            AwsSolutions-IAM5
Resource:        /app-dev/Handler/ServiceRole/DefaultPolicy
Finding:         IAM policy allows "logs:PutLogEvents" on a wildcard log-stream ARN.
Security impact: A compromised function could write to any log stream in the account.

Recommended fix:
  Create the log group explicitly and grant writes only to that group's streams.

Alternative options:
  1. Keep the wildcard and accept it with a documented NagSuppression (scope: this policy only).
  2. Replace the custom role with the AWS managed basic execution role (wider, but standard).

Trade-offs:
  Option 1 keeps the template small but permanently accepts a wildcard.
  Option 2 is conventional and easy to review, but grants more than this function needs.
```

Then ask which direction to take, and only implement after the answer.

## Acknowledgement (suppression) policy

Making cdk-nag green is never a valid reason to acknowledge a finding away.

An acknowledgement is an exception, and needs all of:

- an explanation of why the resource itself cannot satisfy the rule,
- the accepted risk, stated in one sentence,
- the narrowest possible scope — the specific construct, and the specific finding where the rule
  reports several,
- a `reason` string a reviewer can audit later (who accepted it, when),
- the user's explicit agreement.

Take the id verbatim from the `Acknowledge with '...'` line that cdk-nag prints — the format differs
per rule (`AwsSolutions::AwsSolutions-DDB3` for a whole rule, `AwsSolutions-IAM5[Action::s3:*]` for
one granular finding), so do not hand-assemble it.

```ts
import { Validations } from 'aws-cdk-lib';

Validations.of(handlerRole).acknowledge({
  id: 'AwsSolutions-IAM5[Resource::<log-group-arn>:log-stream:*]',
  reason:
    'CloudWatch Logs PutLogEvents requires a log-stream wildcard; scoped to this function log ' +
    'group only. Accepted by <owner> on <date>.',
});
```

Acknowledge on the narrowest construct that owns the finding. `Validations.of(stack).acknowledge()`
covers every resource in the stack — that is almost never what you want, and it silently absorbs
future violations of the same rule.

## Destructive change policy

If `cdk diff` (or a snapshot diff) shows resource deletion or replacement, IAM expansion, public
exposure, weaker encryption, changed retention, or a networking change, stop and present: detected
change, impact, why it happens, recommended approach, alternatives, operational considerations. The
user decides.

Logical ID changes on stateful resources, removal-policy changes, and physical-name changes are the
usual hidden causes of replacement — check for them before proposing anything.
