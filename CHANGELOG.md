# Changelog

All notable changes to Docs Impact Gate will be recorded in this file.

## [Unreleased]

### Added

- Read-only self-dogfood checks in audit mode for publisher pull requests.
- A privacy-safe, opt-in GitHub Issue Form for audit-pilot feedback.

### Changed

- Marketplace-facing setup examples now use the verified immutable v0.2.0
  commit pin directly instead of unresolved publisher and SHA placeholders.
- The Marketplace README now shows a renderer-synchronized audit report and
  links to the three publisher-owned public demo scenarios.

## [0.2.0] - 2026-08-20

### Added

- Optional `enforcement: audit` pilot mode that reports policy violations
  without failing the workflow step; `block` remains the default.
- Strict enforcement-input validation before any GitHub API client is created.

## [0.1.0] - 2026-08-20

### Added

- Pre-release Node 24 GitHub Action bundle.
- Strict version-1 YAML policy parsing.
- Explicit documentation, changelog, and version decisions from pull-request
  bodies.
- Deterministic pass/fail reports without source, patch, or decision-text
  disclosure.
- Local unit, orchestration, and packaged-action end-to-end tests.

Public pre-release package validated in `FastPhive/docs-impact-gate-demo` with
passing, failing, and explicit-decision pull-request scenarios and published as
the initial GitHub Marketplace version.
