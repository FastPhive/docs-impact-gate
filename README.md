# Docs Impact Gate

> `v0.2.0` is the current GitHub Marketplace release. It adds an audit-first
> rollout mode to the deterministic blocking behavior introduced in `v0.1.0`.

Docs Impact Gate requires an explicit documentation, changelog, and version
decision when relevant files change in a pull request. It uses repository-owned
YAML rules and runs entirely inside the GitHub Actions runner.

## Why

Fast code changes can leave documentation and release decisions implicit. This
Action turns those expectations into a deterministic pull-request gate without
uploading source code or full diffs to a vendor service.

## What the free core does

- Matches changed filenames against strict version-1 YAML rules.
- Accepts a matching documentation/release file or a detailed explicit reason.
- Produces a deterministic Action Summary with repair guidance.
- Supports an audit-first rollout that reports violations without blocking the
  workflow step; `block` remains the default.
- Reads only pull-request metadata and changed filenames.
- Omits decision reasons, source patches, and raw pull-request bodies from
  reports.

## See it in action

When a production file changes without a required documentation file or an
explicit decision, `enforcement: audit` produces this deterministic Action
Summary while leaving the workflow step non-blocking:

```text
# Docs Impact Gate

**AUDIT — 1 violation(s) found; the step was not blocked.**

## Rule: production-docs

- Description: Production changes require user or architecture documentation.
- Trigger patterns: src/**
- Triggering files: src/api/client.ts
- Required paths (any): docs/USAGE.md, docs/ARCHITECTURE.md
- Satisfying files: none
- Decision: docs (minimum 15 characters)
- Outcome: violation
- Repair: Add at least one matching required path or provide a sufficiently detailed reason in the `docs-impact` block.
```

Inspect the publisher-owned public scenarios: a
[documentation update passes](https://github.com/FastPhive/docs-impact-gate-demo/pull/1),
a [missing decision blocks](https://github.com/FastPhive/docs-impact-gate-demo/pull/2),
and an
[explicit decision passes](https://github.com/FastPhive/docs-impact-gate-demo/pull/3).
These scenarios verify behavior; they are not evidence of external adoption.

## Join the audit pilot

The first cohort currently has **0/3 confirmed external repositories**. Follow
the [pinned pilot tracker](https://github.com/FastPhive/docs-impact-gate/issues/4)
for transparent progress. Try `enforcement: audit` on real pull requests without
blocking merges, then
[share opt-in pilot feedback](https://github.com/FastPhive/docs-impact-gate/issues/new?template=audit-pilot.yml).
Publisher-owned demos and self-checks are not counted as external adoption.
The form asks for aggregate feedback without separate contact details; a
repository reference is optional and must be public or explicitly authorized
for disclosure. Never include secrets, private repository content, personal
contact details, or vulnerability reports.

## Usage

Add `.github/docs-impact.yml`:

```yaml
version: 1
rules:
  - id: production-docs
    description: Production changes require user or architecture documentation.
    if_changed:
      - src/**
    require_any:
      - docs/USAGE.md
      - docs/ARCHITECTURE.md
    decision: docs
    min_reason_length: 15
```

Add this copy-ready `pull_request` workflow. Both third-party Actions are
pinned to verified immutable commits:

```yaml
name: Docs Impact Gate

on:
  pull_request:

permissions:
  contents: read
  pull-requests: read

jobs:
  docs-impact:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: FastPhive/docs-impact-gate@6683d10b1aa4768e433bc5ba2498f1f0b9477c70 # v0.2.0
        with:
          github-token: ${{ github.token }}
          policy-file: .github/docs-impact.yml
          enforcement: audit
```

If no required file changes, include exactly one block in the pull-request
body:

```docs-impact
docs: Internal refactor only; user behavior remains unchanged.
changelog: No release note because behavior remains unchanged.
version: No package API or distributed artifact changed.
```

## Inputs and outputs

Inputs:

- `github-token` — required read-only token for changed filenames.
- `policy-file` — optional repository-relative path; defaults to
  `.github/docs-impact.yml`.
- `enforcement` — optional `audit` or `block`; defaults to `block`. Use `audit`
  while calibrating a new repository policy.

Outputs:

- `result` — `pass` or `fail`.
- `violations-count` — number of violated rules.
- `report` — deterministic Markdown report.

## Local development

Requires Node.js 24.

```bash
npm ci
npm run check
npm audit --audit-level=high
```

The check builds the committed Action bundle before running unit,
orchestration, and three packaged-action end-to-end scenarios.

## Security and privacy

Use `pull_request`, least-privilege read permissions, and full commit SHA pins.
Do not use `pull_request_target`. See [Security](docs/SECURITY.md),
[Privacy](docs/PRIVACY.md), and the complete [Usage guide](docs/USAGE.md).

## Current limits

- [Marketplace listing](https://github.com/marketplace/actions/docs-impact-gate)
- Public releases `v0.1.0` and `v0.2.0` are available; three blocking-mode demo
  scenarios and the packaged audit-mode scenario are verified.
- The Marketplace listing is live; view and installation counts are not yet
  available in the local venture state.
- GitHub's 3,000-file pull-request API ceiling fails closed.
- The repository-local policy can be changed within a pull request.
- Paid policy locking, checkout, licensing, analytics, and vendor services are
  not implemented.
