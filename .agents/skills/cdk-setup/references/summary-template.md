# Setup summary template

Report this after step 6. Fill every section from real output — never from expectation. If a step
failed, show it as `FAIL` and explain; a partially working setup reported honestly is worth more than
a green table that lies.

```text
cdk-setup complete: <project-name>

Environment
-----------
Node.js:        <version>          (detected)
Package manager: <pnpm x.y.z>      (detected / chosen)
aws-cdk-lib:    <version>          (resolved at install time)
aws-cdk CLI:    <version>
cdk-nag:        <version>
TypeScript:     <version>
Vitest:         <version>
ESLint:         <version>

Location
--------
Repository root: <path>
CDK project:     <path>

Generated
---------
bin/app.ts
lib/config/environments.ts
lib/stacks/application-stack.ts
lib/constructs/application/<...>
test/stacks/<...>.test.ts
test/constructs/<...>.test.ts
package.json, tsconfig.json, cdk.json, vitest.config.ts,
eslint.config.mjs, prettier.config.mjs, .prettierignore, .gitignore, README.md
<repo-root>/.agents/skills/cdk-development/, cdk-review/
<repo-root>/.github/copilot-instructions.md

Validation
----------
format:check: PASS
lint:         PASS
build:        PASS
test:         PASS   (<n> tests: snapshot + fine-grained)
synth:        PASS
cdk-nag:      PASS   (AwsSolutionsChecks, 0 errors, 0 warnings)

Design decisions
----------------
- Environments <dev,prod> are environment-agnostic (account unset) so synth works without
  credentials. Fill in account IDs in lib/config/environments.ts when you are ready.
- <starter construct / empty stack> because <reason from the interview>.
- One stack per environment; stacks are deployment boundaries, complexity goes into constructs.
- Removal policy RETAIN on stateful resources by default — change it per environment if you want
  dev tear-down.

Known limitations
-----------------
- No AWS resource was created or modified; nothing was deployed.
- <account IDs unset / bootstrap status unknown / example construct still in place>
- CI/CD pipeline definition is out of scope; `<pm> check` is the platform-independent entry point.

Next steps (you run these, not me)
----------------------------------
1. Fill in account IDs: lib/config/environments.ts
2. Verify identity:     aws sts get-caller-identity --profile <profile>
3. Bootstrap if needed: npx cdk bootstrap aws://<account>/<region> --profile <profile>
4. Review the diff:     npx cdk diff <stack> --profile <profile>
5. Deploy:              npx cdk deploy <stack> --profile <profile>

Ask me to continue with cdk-development when you want to implement infrastructure.
```
