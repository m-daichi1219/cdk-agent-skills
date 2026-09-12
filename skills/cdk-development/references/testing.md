# Testing CDK code

Vitest + `aws-cdk-lib/assertions`. Local, deterministic, no credentials.

## Always: a snapshot per stack

```ts
const synthesize = (): Template => {
  const app = new App();
  const stack = new ApplicationStack(app, 'TestStack', {
    env: { region: 'ap-northeast-1' },
    projectName: 'my-app',
    environmentName: 'dev',
  });

  return Template.fromStack(stack);
};

it('matches the CloudFormation snapshot', () => {
  expect(synthesize().toJSON()).toMatchSnapshot();
});
```

Commit snapshots. Read every snapshot diff: replacement, deletion, IAM and encryption changes surface
there first. Never update a snapshot you have not understood, and never update one that shows a
security or data-loss change without telling the user.

## Also: fine-grained assertions

Required whenever configuration is generated rather than written literally:

```ts
// props-driven value
template.hasResourceProperties('AWS::Lambda::Function', { MemorySize: 512 });

// security-relevant property
template.hasResourceProperties('AWS::S3::Bucket', {
  BucketEncryption: Match.objectLike({
    ServerSideEncryptionConfiguration: Match.arrayWith([Match.anyValue()]),
  }),
});

// data protection
template.hasResource('AWS::DynamoDB::Table', {
  DeletionPolicy: 'Retain',
  UpdateReplacePolicy: 'Retain',
});

// loop / conditional output
template.resourceCountIs('AWS::SQS::Queue', 2);

// IAM: assert the action set, not the whole policy document
template.hasResourceProperties('AWS::IAM::Policy', {
  PolicyDocument: Match.objectLike({
    Statement: Match.arrayWith([
      Match.objectLike({ Action: ['dynamodb:GetItem'], Effect: 'Allow' }),
    ]),
  }),
});
```

Use `Match.objectLike` / `Match.arrayWith` for partial matching and `Capture` to relate two generated
values:

```ts
const queueArn = new Capture();
template.hasResourceProperties('AWS::Lambda::EventSourceMapping', { EventSourceArn: queueArn });
expect(queueArn.asObject()).toBeDefined();
```

## Construct tests

Test a construct in a bare `Stack`, asserting defaults and that every override actually reaches the
template:

```ts
it('defaults to a retained table', () => { ... });
it('lets a caller opt out explicitly', () => { ... });
```

## Don't

- Don't assert generated logical IDs or asset hashes — they change with every refactor.
- Don't test AWS behaviour; test your infrastructure definition.
- Don't add credential- or network-dependent tests to the default `test` script.
- Don't delete or skip a failing test to move on. Fix the cause or report it.
