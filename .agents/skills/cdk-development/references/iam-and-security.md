# IAM and security

## The ladder

1. **L2 grant API** — `bucket.grantRead(handler)`, `table.grantReadWriteData(handler)`
2. **Service-specific API** — `queue.grantConsumeMessages(handler)`, `secret.grantRead(handler)`
3. **Explicit `PolicyStatement`** — concrete actions, concrete resource ARNs
4. **Wildcard** — only with a reason the user accepted, and the narrowest possible scope

```ts
// Prefer
bucket.grantRead(handler);

// Avoid
new PolicyStatement({ actions: ['s3:*'], resources: ['*'] });
```

Never generate `Action: '*'`, `Resource: '*'`, `AdministratorAccess`, or a broad AWS managed policy
for convenience. When an action genuinely does not support resource-level permissions, say which
action, why, and how the scope is bounded (condition keys, resource prefix, separate role).

## Roles

- One role per function/task with only what that workload needs; do not share a role "for
  simplicity".
- Grant on the narrowest resource: a single table, a key prefix, one secret ARN.
- `grant*` on an encrypted resource also grants the KMS key. Check the generated policy in the
  snapshot rather than assuming.
- Cross-account or cross-service trust policies are always a user decision.

## Secure defaults

| Area | Default |
| --- | --- |
| Network | private; no public endpoint unless explicitly required |
| Encryption | enabled at rest and in transit; AWS-managed key unless the project chose a CMK |
| Access | least privilege, deny by default |
| Logging | enabled where it is cheap and useful; retention set explicitly |
| Secrets | Secrets Manager / SSM SecureString, referenced at runtime, never in code |
| Data | removal policy `RETAIN` for stateful resources; deletion protection for production |

Context-dependent, so always ask: public exposure, VPC placement, CMK strategy, retention periods,
removal policy per environment, cross-account access, IAM scope expansion.

## cdk-nag findings

Run `<pm> run nag`. cdk-nag v3 runs as a CDK policy validation plugin
(`Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }))`) and reports at
ERROR or WARNING level; the `nag` script uses `cdk synth --strict` so warnings fail too.

When a finding appears, do not fix it silently and never acknowledge it away to get a green build.
Report it:

```text
Rule:            AwsSolutions-<id>
Resource:        <construct path>
Finding:         <what the rule detected>
Security impact: <what could go wrong>

Recommended fix: <the change that removes the finding at the resource>
Alternatives:    <other viable options>
Trade-offs:      <cost, effort, operational impact of each>
```

Then ask which direction to take and implement only that.

## Acknowledgements (suppressions)

An exception, never a tactic. One needs: why the resource cannot satisfy the rule, the accepted risk,
the narrowest scope, an audit-ready `reason`, and the user's explicit agreement.

cdk-nag v3 removed `NagSuppressions`; use CDK's native API on the construct that owns the finding:

Copy the id from the `Acknowledge with '...'` line cdk-nag prints; the format differs per rule
(`AwsSolutions::AwsSolutions-DDB3` for a whole rule, `AwsSolutions-IAM5[Action::s3:*]` for one
granular finding).

```ts
import { Validations } from 'aws-cdk-lib';

Validations.of(handlerRole).acknowledge({
  id: 'AwsSolutions-IAM5[Resource::<log-group-arn>:log-stream:*]',
  reason:
    'PutLogEvents requires a log-stream wildcard, scoped to this function log group. ' +
    'Accepted by <owner> on <date>.',
});
```

Never acknowledge on the stack or the app: it absorbs every current *and future* violation of that
rule.

## Destructive change

Resource deletion or replacement, IAM expansion, public exposure, weaker encryption, changed
retention, networking change: stop and present detected change, impact, why it happens, recommended
approach, alternatives, operational considerations. The user decides.

Usual hidden causes: a changed construct ID or stack name, a changed physical name, a changed
partition/sort key, a removal-policy change, moving a resource between stacks.
