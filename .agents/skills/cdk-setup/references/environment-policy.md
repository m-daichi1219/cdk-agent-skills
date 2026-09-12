# AWS environment policy

Keep two things strictly separate:

- **Deployment target** — which account and region a stack belongs to. Project configuration, lives
  in git (`lib/config/environments.ts`).
- **Credential** — how you authenticate. Never in git, never in CDK code.

## Deployment targets

```ts
export const environments = {
  dev: { account: undefined, region: 'ap-northeast-1' },
  prod: { account: '222222222222', region: 'ap-northeast-1' },
} as const satisfies Record<string, EnvironmentConfig>;
```

`account: undefined` produces an environment-agnostic stack: it synthesizes without credentials,
which keeps `pnpm check` local and deterministic. Filling in the real account ID is the user's
decision — it pins the stack to that account, which is what you want before production use, and it
is required for context lookups (VPC, AMI, hosted zone).

Never write an account ID the user has not given you, and never read `CDK_DEFAULT_ACCOUNT` in
construct code — it silently binds the template to whoever ran the command.

## Credentials

Any of these is fine, and none of them belongs in code: IAM Identity Center (SSO), a named AWS CLI
profile, AssumeRole, CI OIDC, or the default provider chain. Do not hard-code or template a profile
name into the CDK app; pass `--profile` / `AWS_PROFILE` at the command line.

## Safety check before any AWS-facing command

```bash
aws sts get-caller-identity
```

Compare expected vs authenticated account, and expected vs configured region. If they differ, stop
and tell the user. Do not "just try it".

## Bootstrap

An environment needs `cdk bootstrap` once per account/region. Detect the likely need (no
`CDKToolkit` stack / no bootstrap version parameter), then hand the command to the user:

```text
Target account: 111111111111
Target region:  ap-northeast-1
Command:        npx cdk bootstrap aws://111111111111/ap-northeast-1 --profile <profile>
Expected change: creates the CDKToolkit stack (S3 asset bucket, ECR repo, IAM roles, SSM parameter).
```

Never run it yourself, even after the user says yes — bootstrap creates IAM roles and an S3 bucket in
their account. The human runs it.

## Deployment

You may run: `cdk synth`, `cdk diff`, `cdk ls`, lint, build, test, cdk-nag.

You may not run: `cdk deploy`, `cdk destroy`, `cdk bootstrap`, `cdk import`, `cdk migrate`,
`aws cloudformation *` mutations, or anything else that changes an AWS account.

Finish analysis, then print the command:

```text
Recommended command (run it yourself):
  npx cdk deploy my-app-dev --profile dev-admin
```

The `deploy` script exists in `package.json` for the user's convenience. It is not for you.
