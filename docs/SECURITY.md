# Security Policy

## Secret Scanning & Leak Prevention

This repository is scanned automatically for exposed credentials using Gitleaks.

### Local Prevention

- Pre-commit hooks run Gitleaks on every `git commit`.
- Install hooks with: `pip install pre-commit && pre-commit install`
- Manual scan: `pre-commit run --all-files`

### CI Enforcement

- Gitleaks runs on every push and pull request across all branches.
- A detected secret fails the workflow immediately.
- Full history is scanned (`fetch-depth: 0`) to catch historical leaks.

### Supported Secret Patterns

Custom rules in `.gitleaks.toml` target:
- Stellar Ed25519 secret seeds (`S[A-Z0-9]{55}`)
- JWT secrets
- Generic API keys
- PEM private key blocks

### Incident Response

If a secret is detected:

1. **Rotate immediately**
   - JWT / API keys: regenerate and deploy new values.
   - Stellar secret keys: move funds to a new account and revoke the old key.
   - Database credentials: reset passwords and rotate connection strings.

2. **Revoke the commit**
   - If the secret was committed, rewrite history to purge it:
     ```bash
     git filter-branch --force --index-filter \
       "git rm --cached --ignore-unmatch path/to/secret" \
       --prune-empty --tag-name-filter cat -- --all
     ```
   - Force-push the rewritten branch and open a PR to update references.

3. **Audit access logs**
   - Review CloudWatch / Datadog for any unauthorized access between the time of leak and rotation.

4. **Notify stakeholders**
   - Report the incident to the security team and affected service owners within 24 hours.

### Reporting

Found a false positive or missed pattern? Open an issue referencing `.gitleaks.toml`.
