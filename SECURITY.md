# Security Policy

## Reporting

Please do not open public issues for suspected vulnerabilities.

- Email: `security@spotonsight.app`
- Include reproduction steps, impact, and affected components

## Scope

This repository covers the SpotOnSight backend API, Vue frontend, and Capacitor mobile wrapper.

## Secrets

- Never commit production credentials
- Use `.env.example` as the reference for local development setup only
- Use `.env.staging.example` and `.env.production.example` as deployment variable templates only
- Keep real runtime env files and secret values outside version control
- Rotate any accidentally exposed secrets immediately
