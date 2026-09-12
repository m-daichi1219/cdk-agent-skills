# Construct and stack design

## Props

- One props interface per construct, `readonly` fields, named `<Construct>Props`.
- Required props for what the construct cannot know; optional props with a safe default for
  everything else. Document the default in the doc comment, including *why* it is safe.
- Never widen a prop to `any` or pass a raw CloudFormation object through. If a caller needs deep
  control, expose the L2 construct (`public readonly table: Table`) so they can use the escape hatch
  explicitly.
- Validate props that have invariants (`if (props.retentionDays < 1) throw new Error(...)`). A build
  time error beats a deployment rollback.

```ts
export interface QueueProcessorProps {
  /** Handler invoked per message. */
  readonly handler: IFunction;
  /** Visibility timeout. Defaults to 6x the handler timeout, the AWS recommended ratio. */
  readonly visibilityTimeout?: Duration;
  /** Retries before a message goes to the DLQ. Defaults to 3. */
  readonly maxReceiveCount?: number;
}
```

## Exposing what you created

Expose the underlying constructs the caller legitimately needs (`table`, `queue`, `function`) as
`public readonly`. That keeps grants and integrations idiomatic:

```ts
processor.queue.grantSendMessages(producer);
```

Do not re-implement `grant*` helpers on your construct unless you are deliberately narrowing them.

## Stack boundaries

Split a stack only for: independent deployment, independent rollback, different lifecycle, different
account, different region, different ownership, blast-radius separation, CloudFormation quotas, or an
explicit architecture requirement. Any split is a user decision — propose it with the boundary and
the trade-off (cross-stack references create deployment ordering and export locks).

Prefer passing constructs directly within a stack over `CfnOutput`/`Fn::ImportValue` between stacks;
a consumed export cannot be changed without a two-phase deployment.

## Naming and identity

- Construct ID = PascalCase, stable forever. The logical ID derives from it: changing the ID of a
  construct that owns a stateful resource replaces it and destroys its data.
- Let CloudFormation generate physical names unless the user needs a fixed one. Explicit physical
  names prevent replacement-in-place and collide across environments.
- Environment-specific values come from `lib/config/environments.ts` through props, never from
  `process.env` inside a construct.

## Escape hatches

When the L2 cannot express something, reach for the escape hatch explicitly and leave a comment
saying why:

```ts
const cfnTable = table.node.defaultChild as CfnTable;
cfnTable.addPropertyOverride('SSESpecification.SSEType', 'KMS');
```

An escape hatch always needs a fine-grained assertion — nothing else proves it still works after a
CDK upgrade.

## Lambda and application code

Keep runtime code out of `lib/`: `src/` (or the repository's existing location) holds application
code, `lib/` holds infrastructure. Bundle with `NodejsFunction` when the project already uses it.
Give every function an explicit log retention and an explicit, least-privilege role, and remember
that a Lambda default execution role triggers cdk-nag `AwsSolutions-IAM4`/`IAM5` — decide with the
user how to resolve that rather than suppressing it.
