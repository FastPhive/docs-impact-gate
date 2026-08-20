# Security Policy

## Supported versions

Docs Impact Gate `v0.2.0` is the current supported GitHub Marketplace release.
Version `v0.1.0` remains available as the initial blocking-only release.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/FastPhive/docs-impact-gate/security/policy)
for this repository.

Security contact: jan.voigtmann@gmail.com

Private vulnerability reporting is enabled in the repository settings.

The public security intake channel is active.

## Security boundary

The free core:

- requests read-only repository and pull-request permissions;
- retrieves changed filenames through `pulls.listFiles` only;
- does not retrieve source files, patches, full diffs, or commit contents;
- does not execute pull-request text or policy values in a shell;
- masks the supplied GitHub token before client creation;
- omits raw decision reasons and pull-request bodies from reports;
- fails closed on invalid configuration and at GitHub's 3,000-file API ceiling.

The package has no payment, license, analytics, or vendor-operated backend in
its current form.
