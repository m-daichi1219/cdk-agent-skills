# AWS CDK Agent Skills Development Instructions

## 1. Purpose

安全で一定品質の AWS CDK 開発環境を、短時間で構築・利用できる Agent Skills 群を作成する。

この Skill 群の主な利用環境は GitHub Copilot とする。

Skill 自体の設計・実装には Cursor を利用するが、Cursor 固有仕様には依存せず、可能な限り Agent Skills の標準仕様に準拠すること。

Skill の置き場所は役割で分ける。

このリポジトリ（配布元）の canonical location:

```text
skills/
```

利用側プロジェクト（Copilot / Cursor が読む配置、`cdk-setup` が書き込む先）:

```text
.agents/skills/
```

最終的には、利用者が少数の質問に答えるだけで、

* AWS CDK 開発環境
* 推奨フォルダ構成
* lint / format / test
* CDK synth
* cdk-nag
* CDK 開発ルール
* CDK レビュールール

が利用可能になることを目指す。

---

# 2. Core Philosophy

本 Skill 群の基本思想は以下とする。

> Golden Path + Escape Hatch

AWS CDK 開発における安全かつ実践的な標準ルートを Skill 側で提供する。

一方で、プロジェクト固有の事情やビジネス要件によって標準から外れる必要がある場合には、それを禁止しない。

ただし、Agent がプロジェクト固有の意思決定を勝手に行ってはならない。

---

# 3. Decision Policy

設計・実装時の判断を以下の4分類で考える。

## Guardrail

安全性や破壊リスクに関係するもの。

Agent が独自判断で変更してはならない。

例:

* secrets をコードへ埋め込まない
* deployment を Agent が実行しない
* cdk-nag の警告を通すためだけに suppression しない
* destructive change を勝手に適用しない
* IAM wildcard を安易に利用しない
* project / business context が必要な判断を勝手に行わない

---

## Golden Default

多くの案件で合理的な標準。

Agent がデフォルトとして採用してよい。

例:

* TypeScript
* AWS CDK v2
* pnpm
* ESLint
* Prettier
* Vitest
* AWS CDK Assertions
* cdk-nag
* L2 Construct 優先
* Custom Construct による論理的な抽象化

ユーザーから明示的な希望があれば変更可能とする。

---

## Context Dependent

プロジェクトやビジネス要件によって正解が変わるもの。

Agent が勝手に決めてはいけない。

例:

* VPC に Lambda を配置するか
* public access を許可するか
* removal policy
* retention period
* encryption key strategy
* Stack の分割
* architecture change
* destructive change
* IAM permission の拡大
* cdk-nag finding への対応方法

Agent は、

1. 現状
2. 問題
3. 推奨方針
4. 他の選択肢
5. 主な考慮事項

を提示し、ユーザーへ判断を求めること。

---

## Automatically Detectable

環境やリポジトリから取得できる情報については、原則としてユーザーへ質問しない。

例:

* Node.js version
* package manager
* lock file
* AWS CLI
* AWS CDK CLI
* Git
* package.json
* cdk.json
* repository structure

---

# 4. Skill Responsibilities

初期バージョンでは Skill を以下の3つに分割する。

```text
skills/
├── cdk-setup/
├── cdk-development/
└── cdk-review/
```

責務を明確に分けること。

---

# 5. cdk-setup Responsibility

`cdk-setup` は AWS CDK 開発環境を構築する。

主な責務:

* prerequisite check
* 対象ディレクトリ決定
* CDK project 初期化
* dependencies install
* directory structure 作成
* configuration 作成
* package scripts 作成
* lint / format 設定
* test 設定
* cdk-nag 設定
* repository instructions 作成
* development / review Skill の配置
* validation
* setup 結果の summary

アプリケーション固有の AWS architecture を大量に実装することは責務外とする。

---

# 6. cdk-development Responsibility

`cdk-development` は AWS CDK を実装するときの設計・コーディング支援を行う。

主な責務:

* AWS CDK code generation
* Construct design
* Stack design
* IAM implementation
* AWS resource implementation
* test generation
* AWS recommended practice の適用
* existing project convention の尊重

単なるコード生成ではなく、

> なぜその設計を採用するのか

を考慮して実装する。

プロジェクトやビジネスのコンテキストによる判断が必要な場合は、勝手に決定しない。

---

# 7. cdk-review Responsibility

`cdk-review` は AWS CDK の品質・安全性レビューを行う。

主な責務:

* format
* lint
* build
* test
* synth
* cdk-nag
* IAM review
* security review
* CDK design review
* CloudFormation diff / generated template review
* destructive change の検出

レビューで問題を検出した場合、原則として勝手に修正しない。

特に architecture / security / IAM / destructive change に関係するものについては、

```text
Issue
Recommended fix
Alternative options
Trade-offs
```

をユーザーへ提示する。

その後ユーザーの指示に従って修正する。

---

# 8. Initial Scope

v1 の `cdk-setup` は基本的に空のディレクトリを対象とする。

既存 CDK project の migration / modification は v1 の主要対象としない。

ただし、CDK project が Git repository の root に存在するとは限らない。

例えば以下を許容する。

```text
repository/
├── src/
│   └── lambda/
│
└── cdk/
```

または、

```text
repository/
├── application/
└── infrastructure/
```

そのため Setup Skill は、

```text
Where should the CDK project be created?
```

のように対象ディレクトリを扱えるようにする。

例:

```text
.
./cdk
./infrastructure
```

対象ディレクトリが存在しなければ作成可能とする。

ただし、v1 では対象ディレクトリそのものは原則として空であることを前提としてよい。

既存ファイルが存在する場合は無条件で上書きしてはならない。

---

# 9. Setup Interaction

ユーザーへの質問は最小限とする。

利用者とのヒアリングによって、そのプロジェクトに適した初期構成を作る。

Small / Standard / Large のような固定 preset は設けない。

質問例:

```text
CDK project directory
Project name
Main application type / purpose
Expected AWS resources
AWS environment strategy
Preferred package manager if different from default
```

ただし、質問を増やしすぎない。

現在のタスクに必要ない情報を先回りして聞かない。

---

# 10. Standard Technology Stack

基本構成:

```text
Language:
TypeScript

AWS CDK:
AWS CDK v2

Package manager:
pnpm

Lint:
ESLint

Format:
Prettier

Test:
Vitest

Infrastructure Assertions:
AWS CDK Assertions

Security:
cdk-nag
```

既存環境が存在する場合は既存 package manager を優先する。

利用者が明示的に npm / yarn 等を希望した場合もその希望を尊重する。

---

# 11. Version Policy

原則として実行時点で利用可能な、

> 最新かつ安定したバージョン

を利用する。

Node.js については LTS version を利用する。

AWS CDK、cdk-nag、Vitest、ESLint 等については実行時点の安定版を利用してよい。

Skill 実行時期によって生成される version が変化することを許容する。

例えば、

```text
2025:
aws-cdk-lib 2.xxx

2026:
aws-cdk-lib 2.yyy
```

となっても問題ない。

ただし、一度 project を生成した後は、

```text
package.json
pnpm-lock.yaml
```

によって project 内の version 再現性を保証する。

---

# 12. Standard Project Structure

基本構成:

```text
bin/
└── app.ts

lib/
├── stacks/
│   └── application-stack.ts
│
├── constructs/
│   ├── application/
│   └── patterns/
│
└── config/
    └── environments.ts

test/
├── stacks/
└── constructs/
```

これは固定構造ではない。

利用者とのヒアリングによって適切な構造を決める。

ただし AWS service 単位だけでフォルダを分割する構造をデフォルトにしない。

Avoid:

```text
lib/
├── lambda/
├── dynamodb/
├── s3/
└── cloudfront/
```

Prefer logical responsibility / application domain / construct boundary.

---

# 13. Construct Design

AWS CDK の基本原則として、

> Model with Constructs, deploy with Stacks

を採用する。

繰り返し利用する Infrastructure pattern や標準設定については Custom Construct を利用する。

例:

```text
StandardLambda
ApplicationApi
StaticWebSite
QueueProcessor
```

ただし、単にコード行数を減らすためだけにすべての L2 Construct を独自 Construct でラップしてはならない。

Custom Construct を導入する候補:

* 同じ設定が何度も繰り返される
* security policy を共通化したい
* project standard を強制したい
* 複数 AWS resource が1つの論理機能を構成する
* domain concept を Infrastructure として表現したい

単発の単純 Resource は L2 Construct を直接利用してよい。

---

# 14. Stack Design

Stack はコード整理単位ではなく、

> deployment boundary

として扱う。

Stack 内のコード量が増えたという理由だけで Stack を分割しない。

コードの複雑さは原則として Construct に分離する。

Stack を分割する主な理由:

* independent deployment
* independent rollback
* different lifecycle
* different AWS account
* different AWS region
* different ownership
* blast radius separation
* CloudFormation quota
* explicit architecture requirement

例:

```text
ApplicationStack
├── Api Construct
├── OrderProcessing Construct
└── Database Construct
```

上記のコード量が多くなった場合も、

```text
ApiStack
LambdaStack
DatabaseStack
```

へ単純に分割しない。

---

# 15. Package Scripts

package.json は基本テンプレートを利用してよい。

最低限以下を提供する。

```text
format
format:check
lint
build
test
synth
nag
check
```

必要に応じて、

```text
diff
deploy
```

も提供してよい。

ただし `deploy` はユーザーが手動実行するための command とする。

Agent が実行してはならない。

---

# 16. Validation Pipeline

`npm run check` または `pnpm check` 相当の処理は以下とする。

```text
format
↓
lint
↓
build
↓
test
↓
synth
↓
nag
```

可能であれば failure feedback が早くなる順序にする。

Setup の完了条件として最低限以下が成功している必要がある。

```text
lint
test
synth
nag
```

基本的には `check` 全体が成功する状態を目標とする。

---

# 17. Test Policy

Test framework:

```text
Vitest
+
AWS CDK Assertions
```

---

## Snapshot Test

Snapshot test を必須とする。

生成される CloudFormation template 全体に対する意図しない変更を検出する目的で利用する。

---

## Fine-grained Assertions

以下の場合は Snapshot Test に加えて Fine-grained Assertions を作成する。

* loop
* condition
* property override
* props による値指定
* environment dependent logic
* programmatic resource generation
* important security property
* 特に保証したい resource definition
* complex Construct behavior

例:

```ts
template.hasResourceProperties('AWS::Lambda::Function', {
  MemorySize: 512,
});
```

単純な Resource の存在だけをすべて Fine-grained Assertions で確認する必要はない。

---

# 18. Security Philosophy

AI に Infrastructure code を多く生成させることは許容する。

ただし完全な自由は与えない。

基本方針:

> AWS recommended practices + explicit project guardrails

---

# 19. IAM Policy

IAM implementation priority:

```text
L2 grant API
↓
service-specific API
↓
explicit PolicyStatement
↓
wildcard
```

例:

Prefer:

```ts
bucket.grantRead(handler);
```

Avoid when possible:

```ts
new iam.PolicyStatement({
  actions: ['s3:*'],
  resources: ['*'],
});
```

Agent は least privilege を優先する。

以下を安易に生成してはならない。

```text
Action: "*"
Resource: "*"
AdministratorAccess
broad managed policies
```

必要な場合は理由をユーザーへ説明する。

---

# 20. Security Defaults

原則として以下を優先する。

* private resource
* encryption enabled
* least privilege IAM
* logging enabled where appropriate
* secret management service utilization
* no hard-coded credentials
* no public access unless explicitly required
* L2 Construct secure defaults

ただし business / architecture context によって変更が必要なものについては Agent が勝手に決定しない。

---

# 21. cdk-nag

cdk-nag を標準 validation に含める。

基本 Rule Pack:

```text
AwsSolutionsChecks
```

security validation は比較的厳しく扱う。

---

# 22. cdk-nag Finding Policy

cdk-nag finding が発生した場合、Agent は勝手に修正してはならない。

特に suppression の自動追加は禁止する。

Agent は以下をユーザーへ提示する。

```text
Rule:
Resource:
Finding:
Security impact:

Recommended fix:
...

Alternative:
...

Considerations:
...
```

その後、

> どの方針で修正するか

をユーザーへ確認する。

ユーザー指示後にのみ修正する。

---

# 23. Suppression Policy

以下は禁止する。

> cdk-nag を成功させることだけを目的として finding を suppression する。

Suppression / acknowledgement は例外対応とする。

必要な場合、

* なぜ Resource 側で解決できないのか
* なぜその finding を受け入れるのか
* risk は何か
* scope は最小か

を確認する。

理由のない suppression を禁止する。

---

# 24. AWS Environment Model

以下を明確に分離する。

```text
Deployment Target
```

と

```text
Credential
```

---

## Deployment Target

project configuration として管理する。

例:

```text
dev
stg
prod
```

それぞれ、

```text
account
region
```

を持つ。

概念例:

```ts
export const environments = {
  dev: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },

  prod: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
};
```

---

## Credential

source code とは分離する。

利用可能な方式:

* AWS IAM Identity Center
* AWS CLI Profile
* AssumeRole
* CI OIDC
* AWS credential provider chain

AWS Profile 名を CDK application code へ hard-code しない。

---

# 25. AWS Environment Safety Check

AWS 操作を検討するときは可能であれば、

```bash
aws sts get-caller-identity
```

で現在の authentication context を取得する。

以下を区別する。

```text
Expected account
Authenticated account
Expected region
Configured region
```

一致しない場合は処理を中断する。

---

# 26. cdk bootstrap

Bootstrap が必要か可能な範囲で検出する。

必要な場合は、

```text
Target account
Target region
Command
Expected changes
```

をユーザーへ提示する。

`cdk bootstrap` は AWS environment を変更するため、自動実行してはならない。

ユーザーの明示確認後であっても、原則として Agent 自身が実行するのではなく、実行 command をユーザーへ提示する。

---

# 27. Deployment Policy

以下のような AWS environment を変更する operation は Agent が実行してはならない。

```text
cdk deploy
cdk destroy
cdk bootstrap
aws cloudformation deploy
resource mutation commands
```

Agent は、

1. validation
2. synth
3. diff
4. analysis

までは行ってよい。

その後、

```text
Recommended command:
pnpm deploy ...
```

のようにユーザーへ実行を促す。

実際の deployment は人間が行う。

---

# 28. Destructive Change Policy

`cdk diff` 等で以下を検出した場合:

* Resource deletion
* Resource replacement
* IAM permission expansion
* public exposure
* security downgrade
* persistent data impact
* encryption change
* networking architecture change

Agent は勝手に修正しない。

以下を提示する。

```text
Detected change

Impact

Why this may happen

Recommended approach

Alternative approaches

Business / operational considerations
```

その後ユーザーの方針を確認する。

---

# 29. Always-on Agent Principles

以下は特定 Skill に限定せず、常時守る原則として扱う。

1. Context が必要な意思決定を Agent が勝手に行わない。
2. Security / architecture / business impact がある変更はユーザーへ確認する。
3. 問題だけでなく推奨方針も提示する。
4. 推奨方針の主な理由を説明する。
5. 必要に応じて alternative と trade-off を提示する。
6. AWS environment を変更する command を実行しない。
7. secrets を扱わない。
8. repository の既存 convention を尊重する。
9. validation failure を隠さない。
10. validation を通すことだけを目的とした workaround を行わない。

これらの短い原則は、

```text
.github/copilot-instructions.md
```

等への配置を検討する。

詳細な手順は Skills 側へ置く。

---

# 30. AI and Script Responsibilities

Agent に適した処理:

* repository analysis
* architecture analysis
* user interview
* code design
* Construct design
* review
* finding analysis
* error analysis
* remediation proposal

Script に適した処理:

* prerequisite check
* directory creation
* dependency installation
* deterministic file generation
* package.json generation
* lint
* format
* build
* test
* synth
* nag

決定論的処理は可能な限り scripts にする。

---

# 31. Suggested cdk-setup Structure

```text
skills/
└── cdk-setup/
    ├── SKILL.md
    ├── scripts/
    │   ├── check-prerequisites.*
    │   ├── initialize-project.*
    │   └── verify-project.*
    ├── references/
    │   ├── project-structure.md
    │   ├── testing-policy.md
    │   ├── security-policy.md
    │   └── environment-policy.md
    └── assets/
        ├── package.json
        ├── eslint.config.*
        ├── prettier.config.*
        └── vitest.config.*
```

実際の構造は実装時に改善してよい。

---

# 32. CI/CD

v1 では CI/CD platform について扱わない。

理由:

利用環境によって、

```text
GitHub Actions
Azure DevOps
GitLab CI
Jenkins
etc.
```

が異なるため。

ただし、

```text
pnpm check
```

のような platform-independent validation command を提供する。

これによって将来的に各 CI/CD platform から同じ validation を利用できるようにする。

---

# 33. Distribution

Skill source code は GitHub repository で管理する。

初期段階では個人 GitHub repository でよい。

将来的な社内利用では organization repository への移行を想定する。

可能であれば GitHub CLI の Skill install mechanism 等、Agent Skills 標準に沿った配布方式を利用する。

Skill source と project に配置された Skill の version を追跡できる設計を検討する。

Semantic Versioning を採用可能な構造にする。

---

# 34. cdk-setup Definition of Done

Setup が成功した状態:

* target directory が作成されている
* TypeScript CDK project が存在する
* pnpm environment が構成されている
* dependencies が install されている
* lock file が存在する
* recommended directory structure が存在する
* ESLint が設定されている
* Prettier が設定されている
* Vitest が設定されている
* Snapshot Test が存在する
* 必要箇所に Fine-grained Assertions が存在する
* cdk-nag が設定されている
* lint が成功する
* test が成功する
* synth が成功する
* nag が成功する
* development Skill が利用可能
* review Skill が利用可能
* repository instructions が利用可能
* generated environment の summary が表示される

AWS resource の deployment は Setup 完了条件に含めない。

---

# 35. cdk-setup Self Test

`cdk-setup` を実装した後、Cursor 自身で Setup Skill をテストする。

可能な限り実際の Skill invocation と同じ方法で実行する。

Example:

```text
temporary directory
↓
invoke cdk-setup
↓
create CDK project
↓
pnpm install
↓
pnpm check
↓
inspect generated files
```

少なくとも以下を検証する。

```text
Project creation
Directory structure
Dependencies
package scripts
Formatting
Lint
Build
Snapshot test
Fine-grained test if applicable
Synth
cdk-nag
Agent Skills
Copilot instructions
```

---

# 36. Self-test Safety

Self Test では AWS resource を変更してはならない。

禁止:

```text
cdk deploy
cdk destroy
cdk bootstrap
```

利用してよい:

```text
cdk synth
cdk diff
```

ただし AWS authentication が必要になる test は可能な限り避ける。

Setup Skill 自体の E2E test は local deterministic に実行できることを優先する。

---

# 37. Self-test Result Report

テスト終了後、結果をユーザーへ summary として提示する。

例:

```text
cdk-setup Self Test

Environment
-----------
Node.js: 24.x LTS
pnpm: ...
AWS CDK: ...
cdk-nag: ...

Generated
---------
bin/app.ts
lib/stacks/application-stack.ts
lib/constructs/...
test/...
.github/copilot-instructions.md
.agents/skills/...

Validation
----------
format: PASS
lint: PASS
build: PASS
test: PASS
synth: PASS
cdk-nag: PASS

Tests
-----
Snapshot test: PASS
Fine-grained assertions: PASS

Issues
------
None
```

失敗がある場合も隠さず提示する。

---

# 38. User Acceptance

Self Test 完了後、勝手に次の大きな機能実装へ進まない。

以下をユーザーへ提示する。

```text
Implementation summary
Generated structure
Validation results
Known limitations
Design decisions
Remaining issues
```

そしてユーザーに `cdk-setup` の結果を確認してもらう。

`cdk-development` / `cdk-review` の本格実装へ進む前に、必要に応じて `cdk-setup` を改善する。

---

# 39. Development Order

以下の順序で進める。

## Phase 1

`cdk-setup`

Goal:

```text
empty directory
↓
cdk-setup
↓
minimal interview
↓
TypeScript CDK project
↓
pnpm check
↓
PASS
```

---

## Phase 2

`cdk-development`

AWS CDK implementation guidance を実装する。

---

## Phase 3

`cdk-review`

security / quality / architecture review を実装する。

---

# 40. Implementation Approach for Cursor

この指示書を受け取ったら、いきなり大量のファイルを生成しない。

最初に現在の repository を調査する。

その後、

```text
Current state
Desired state
Proposed Skill architecture
Files to create
Implementation steps
Major design decisions
```

を整理する。

ただし、明確にこの文書で決定済みの事項について再確認を求めない。

実装可能な範囲はそのまま進める。

不明点があっても、プロジェクトの安全性に影響しない軽微な実装詳細については合理的な判断をしてよい。

Security / architecture / business context に関係する重要事項のみユーザーへ確認する。

---

# 41. Quality Goals

本 Skill 群では以下を優先する。

```text
Safety
Consistency
Developer Experience
Maintainability
Reproducibility
Portability
Testability
Transparency
```

Agent に高度な判断能力を利用させる一方で、

> AIに任せた結果、何が起きたのか分からない

状態を作らない。

生成した構成、実行した validation、検出した問題、推奨する変更を利用者が理解できる状態を維持する。

---

# 42. First Milestone

最初の milestone は以下とする。

> Production-quality な `cdk-setup` Agent Skill を作成し、空のディレクトリまたは指定した新規サブディレクトリへ TypeScript AWS CDK v2 project を構築できるようにする。

その結果として、

```text
pnpm check
```

が成功し、

```text
format
lint
build
test
synth
cdk-nag
```

が動作すること。

Snapshot Test を必須とし、必要な箇所では Fine-grained Assertions を利用する。

AWS environment を変更する操作は一切行わない。

最後に Cursor 自身で `cdk-setup` を実行・検証し、その結果をユーザーへ提示すること。

---

# 43. Important Constraint

本 Skill の目的は、

> AIにAWS CDKを自由に書かせること

ではない。

目的は、

> AIを活用しながら、安全性・品質・設計原則を一定範囲に保ち、AWS CDK開発における反復作業と認知負荷を減らすこと

である。

この目的から外れるような「柔軟性のための複雑化」は避ける。

安全な標準ルートを簡単に使え、必要な場合だけ利用者が明示的に標準から外れられる設計を維持すること。
