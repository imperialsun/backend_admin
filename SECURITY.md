# Security policy

## Reporting a vulnerability

Please report security issues privately to the maintainers before any public disclosure.

Recommended report content:

- affected component or file,
- impact and exploit conditions,
- reproduction steps,
- suggested mitigation if available.

## Triage targets

Initial response target: within 5 business days.

## Scope

In scope:

- admin browser security model,
- admin session and CSRF handling,
- runtime configuration exposure,
- Docker and Nginx hardening,
- GitHub Actions security workflows and supply-chain exposure.

Out of scope:

- vulnerabilities in third-party services outside repository control,
- local workstation misconfiguration unrelated to repository code,
- non-reproducible reports without technical details.

## Hardening references

- runtime security and privacy model: [`docs/en/security-privacy.md`](docs/en/security-privacy.md)
- CI and security controls: [`docs/en/ci-quality-observability.md`](docs/en/ci-quality-observability.md)
