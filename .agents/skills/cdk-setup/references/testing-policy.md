# Testing policy

Stack: Vitest + `aws-cdk-lib/assertions`. Tests are local and deterministic — no AWS credentials, no
network, no deployment.

## Snapshot tests are mandatory

Every stack has one snapshot test. Its job is to catch unintended changes to the whole synthesized
CloudFormation template.

```ts
const template = Template.fromStack(stack);
expect(template.toJSON()).toMatchSnapshot();
```

Rules:

- Commit the `__snapshots__` files.
- A snapshot diff is a review artifact. Read it before updating it.
- Never run `vitest -u` to "fix" a failing test until you understand the diff, and never update a
  snapshot that shows a security or data-loss change without telling the user.
- Keep templates snapshot-stable: avoid `Date.now()`, random suffixes, or values read from the
  ambient environment inside construct code.

## Fine-grained assertions

Add them on top of the snapshot whenever behaviour is generated rather than written out:

- loops and conditionals that create resources,
- values driven by props or by environment config,
- property overrides and escape hatches,
- security-relevant properties (encryption, PITR, public access, TLS enforcement, retention),
- IAM policies you care about,
- anything the team must not regress.

```ts
template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
  SSESpecification: { SSEEnabled: true },
});

template.hasResource('AWS::DynamoDB::GlobalTable', {
  DeletionPolicy: 'Retain',
  UpdateReplacePolicy: 'Retain',
});

template.resourceCountIs('AWS::DynamoDB::GlobalTable', 1);
```

Use `Match.objectLike` / `Match.arrayWith` for partial matching, and `Capture` when you need to
assert a relationship between two generated values.

Do not write a fine-grained assertion for the mere existence of every resource — that duplicates the
snapshot and makes refactoring painful. Assert intent, not the entire template.

## Structure

```text
test/stacks/<stack>.test.ts           # snapshot + stack-level wiring
test/constructs/<construct>.test.ts   # construct behaviour and props
```

Synthesize inside a helper so each test gets a fresh `App`:

```ts
const synth = (props?: Partial<ApplicationStackProps>) => {
  const app = new App();
  const stack = new ApplicationStack(app, 'TestStack', { ...defaults, ...props });
  return Template.fromStack(stack);
};
```

## What not to test

- Do not assert on CDK-generated logical IDs or asset hashes.
- Do not test AWS behaviour (that a queue delivers messages) — test your infrastructure definition.
- Do not add tests that need credentials or a deployed environment to the default `test` script.
