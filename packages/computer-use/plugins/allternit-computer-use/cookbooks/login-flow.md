# Cookbook: Login Flow

**Use case:** Authenticate to any web service — direct username/password, OAuth, SSO, 2FA.

---

## Overview

```
navigate → detect auth type → fill credentials → handle MFA → verify session → continue task
```

---

## Auth Type Detection

After navigating, classify the auth method:

| Pattern | Auth type |
|---------|-----------|
| `input[type="password"]` present | Direct credentials |
| "Sign in with Google/GitHub/Apple" button | OAuth |
| SSO redirect to `*.okta.com`, `*.auth0.com` | SAML/SSO |
| Redirect to `/oauth/authorize` | OAuth flow |
| "Verification code" / "Enter the code" prompt | MFA (TOTP/SMS) |

---

## Direct Credential Login

### Protocol

```
1. read_screen()                    ← identify username/email and password fields
2. CHECK: ~~credentials vault       ← fetch stored credentials for this domain
3. type(text=username, selector=email_field)
4. type(text=password, selector=password_field)  ← never log this value
5. screenshot()                     ← capture filled (not the password, it's masked)
6. APPROVAL: "Log in to {domain}?" (confirm/deny)
7. click(submit_button, is_destructive=True)
8. screenshot()                     ← verify login succeeded
```

### Success Detection

```
session_active if:
  - URL no longer contains /login, /signin, /auth
  - User avatar, "My account", "Dashboard" visible in a11y tree
  - Welcome message or username visible
```

### Failure Detection

```
login_failed if:
  - "Invalid credentials", "Wrong password", "Account not found" visible
  - URL unchanged and password field re-focused
  → Report failure, do NOT retry with same credentials
```

---

## OAuth / SSO Flow

```
1. navigate(app_url)
2. click("Sign in with {provider}")
3. ← redirect to provider login page
4. detect: already authenticated? → session redirect back
5. if not: fill provider credentials (same direct flow)
6. ← redirect back to app
7. verify: app session established
```

For SSO redirects through Okta/Auth0:
- Follow redirects automatically (Playwright handles)
- Wait for final app URL before declaring success
- Do not expose SSO tokens or cookies

---

## MFA Handling

### TOTP (Authenticator App)

```
detect: 6-digit code input field after password
action: pause and ask user:
  "MFA required. Please enter your 6-digit authenticator code."
receive: user types code in chat
type(text=mfa_code, selector=code_field)
click(submit)
```

### SMS Code

Same as TOTP — pause and ask user for the SMS code.

### Magic Link / Email Verification

```
detect: "Check your email" message
action: pause and ask user:
  "A login link was sent to {email}. Click it to continue, then say 'done'."
wait: user confirms
screenshot()  ← verify session is now active
```

---

## Post-Login Session Reuse

After a successful login:
- Session is preserved in the Playwright browser context
- Subsequent navigations to the same domain reuse the authenticated session
- No need to re-login within the same session

---

## Security Policy

- **Never** store credentials in session history or logs
- **Never** use stored credentials without user consent per-run
- **Always** show domain before submitting login form
- **Always** get explicit approval before OAuth grant confirmation
