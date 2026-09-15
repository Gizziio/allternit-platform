# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities by email to **security@allternit.com**
or via GitHub private vulnerability reporting on this repository
(Security → Report a vulnerability). Please do not open a public issue for
security-sensitive reports.

Include a description of the issue, affected versions or commit SHAs, and
steps to reproduce. We aim to acknowledge reports within 3 business days.

## Supported versions

Security fixes are applied to the `main` branch. Releases (desktop, CLI,
SDKs) receive fixes in the next tagged release — there are no separate
long-term support branches at this time.

## Scope notes

- The agent workspace website (https://ai.allternit.com) is proprietary and
  is not part of this repository. It is not Allternit Cloud. The cloud
  console is https://platform.allternit.com. Vulnerabilities in those hosted
  surfaces should be reported the same way and will be routed internally.
- This repository must never contain real credentials, API keys, or tokens.
  Configuration is via environment variables; see each package's
  `.env.example` files. If you find a committed secret, report it
  immediately and rotate it — do not paste it into a public issue.
