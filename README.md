# Docs Impact Gate

> v0.1.0 is published in the GitHub Marketplace and validated with a public
> demo repository.

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
- Reads only pull-request metadata and changed filenames.
- Omits decision reasons, source patches, and raw pull-request bodies from
  reports.

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

Add a `pull_request` workflow after replacing the placeholders with the
publisher repository and verified immutable commit:

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
      - uses: FastPhive/docs-impact-gate@<full-commit-sha>
        with:
          github-token: ${{ github.token }}
          policy-file: .github/docs-impact.yml
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
orchestration, and packaged-action end-to-end tests.

## Security and privacy

Use `pull_request`, least-privilege read permissions, and full commit SHA pins.
Do not use `pull_request_target`. See [Security](docs/SECURITY.md),
[Privacy](docs/PRIVACY.md), and the complete [Usage guide](docs/USAGE.md).

## Current limits

- Marketplace listing: https://github.com/marketplace/actions/docs-impact-gate
- Public demo scenarios are verified in the linked publisher and demo repositories.
- GitHub's 3,000-file pull-request API ceiling fails closed.
- The repository-local policy can be changed within a pull request.
- Paid policy locking, checkout, licensing, analytics, and vendor services are
  not implemented.
