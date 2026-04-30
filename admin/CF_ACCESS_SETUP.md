# Cloudflare Access setup runbook — admin.ergsn.net

One-time setup (~30 minutes) so `admin.ergsn.net` becomes a Zero-Trust gated
admin hub that only the owner email can reach. Performed in the Cloudflare
dashboard — **no terminal commands**. This runbook is here so the work
isn't lost between sessions.

> **Pre-flight: have a recovery path.** Add a SECONDARY email (different
> Google account, or a non-Google address) to the Access policy as a
> backup admin. If the primary email is compromised or its inbox is lost,
> the secondary keeps you in. Without this you can lock yourself out.

> **Why Email OTP (One-time PIN) instead of Google OAuth.**
> Owner-confirmed 2026-04-30: simpler UX (no Google account dependency,
> no OAuth client setup, no SSO confusion if you switch Google accounts),
> same Zero-Trust security guarantees underneath. The Worker also
> verifies the JWT signature locally (defense in depth) so even if the
> CF Access policy is misconfigured, the Worker rejects unauthorized
> requests.

## Step 1 — DNS record for the subdomain

1. Open Cloudflare dashboard → select `ergsn.net`
2. **DNS → Records → Add record**
   - Type: `CNAME`
   - Name: `admin`
   - Target: `ergsn.net` (the apex — proxies through the same Workers route the main site uses)
   - Proxy status: **Proxied** (orange cloud)
   - TTL: `Auto`
3. Save. Verify resolution:
   ```
   https://admin.ergsn.net/  →  should hit the same site as ergsn.net (initially the homepage)
   ```

After this runbook + a deploy, this URL will serve `/admin/index.html` instead of the homepage.

## Step 2 — Enable Cloudflare Zero Trust

1. Cloudflare dashboard → **Zero Trust** (left sidebar; if first time, accept the free plan, no card required)
2. Pick a **team name** (this becomes `<teamname>.cloudflareaccess.com`). Suggestion: `ergsn` if available.
   - **Write down the team name** — you'll need it as a Worker secret in Step 7.

## Step 3 — Add Email OTP as the Identity Provider

1. **Settings → Authentication → Login methods → Add new**
2. Choose **One-time PIN** (also labelled "Email OTP" in some dashboards)
3. Configure:
   - Name: `Email OTP`
   - Leave the rest at defaults (CF generates the OTP on demand and emails it)
4. **Test** the integration via the "Test" button — should email a 6-digit PIN to your address; entering it should succeed.

## Step 4 — Add the Application

1. Zero Trust → **Access → Applications → Add an application**
2. Type: **Self-hosted**
3. Application config:
   - Name: `ERGSN Admin Hub`
   - Session duration: **8 hours** (long enough that you don't re-auth all day; short enough that a stolen device session expires)
   - **Application domain (FIRST destination):**
     - Subdomain: `admin`
     - Domain: `ergsn.net`
     - Path: leave empty (whole subdomain is gated)
   - **Add destination (SECOND destination — closes the public-path bypass):**
     - Subdomain: leave empty
     - Domain: `ergsn.net`
     - Path: `/admin/*`
   - Why both: the static admin pages live at `/admin/index.html` and are
     reachable from BOTH `admin.ergsn.net/admin/` AND `ergsn.net/admin/`.
     Gating only the subdomain leaves the apex path open. Gating both
     destinations under a single Application uses the same policy.
4. **Identity providers**: tick **only Email OTP** (uncheck anything else)
5. Click **Next**

## Step 5 — Policy

1. Policy name: `Owner only`
2. Action: **Allow**
3. Configure rules:
   - Selector: `Emails`
   - Value: `jilee1212@gmail.com` (your primary)
   - Click **+ Add include** for the SECONDARY recovery email
4. **Additional settings**:
   - Session duration: 8 hours (already set)
   - Purpose justification: leave off
   - Re-authentication: leave off for now (we can require fresh auth per-action later if needed)
5. Click **Next** → **Add Application**

## Step 6 — Capture the AUD tag (CRITICAL)

After saving the application:

1. Open the application again from the Applications list → look at the URL or the application overview.
2. The AUD tag is a 64-character hex string visible in the application URL or "Overview" panel — labelled **Application Audience (AUD) Tag** or just **AUD**.
3. **Copy this value.** You'll set it as a Worker secret in Step 7.

## Step 7 — Bind the team + AUD as Worker secrets

The trade-docs Worker verifies CF Access JWTs locally for defense in depth. It needs to know:
- which team to fetch the public keys from (JWKS endpoint)
- which AUD tag to expect (so JWTs from a different CF Access app on your account won't work here)

Run from your laptop terminal in the project directory:

```bash
npx wrangler secret put CF_ACCESS_TEAM --config wrangler.trade-docs.jsonc
# Paste the team name from Step 2 (e.g. "ergsn") and press Enter

npx wrangler secret put CF_ACCESS_AUD  --config wrangler.trade-docs.jsonc
# Paste the AUD tag from Step 6 and press Enter
```

The Worker will read these on next request — no redeploy needed.

## Step 8 — Enable the admin deploy (remove admin/ from .cfignore)

Until now, `admin/` has been kept OUT of the public Worker deploy via a
line in `.cfignore`. This is the safety net during setup — without CF
Access in front, deploying admin/ would expose the launcher publicly.

Now that CF Access is gating both `admin.ergsn.net/*` and
`ergsn.net/admin/*`, the admin/ files can be safely deployed. Remove the
`.cfignore` entry and push:

```bash
# In the repo root
sed -i.bak '/^admin\/$/d; /^# Admin hub.*deploy/,/^$/d' .cfignore  # remove the "admin/" rule + comment block
rm .cfignore.bak
git add .cfignore
git commit -m "Enable admin/ in deploy now that CF Access is live"
git push origin main
```

Wait ~60 seconds for the auto-build to finish. (Or check
https://dash.cloudflare.com → Workers & Pages → ergsn → Deployments.)

## Step 9 — Verify the gate works

1. In a fresh incognito window: `https://admin.ergsn.net/admin/`
2. Should redirect to Cloudflare Access login screen
3. Enter your email → check inbox for 6-digit PIN → enter PIN
4. Should land on the admin hub
5. The top bar should show your verified email (`Signed in as <email> via Cloudflare Access`)
6. The audit feed at the bottom should populate (proves Worker JWT verification works)
7. From a NON-allowed email (use any other inbox if you have one): should be denied with "You don't have permission".
8. Visit `https://ergsn.net/admin/` — should ALSO go through CF Access (since the second destination gates the apex path).

If all six work, you're done.

## Step 10 — Repeat for the local-tool subdomains (later, in Phase 2)

Repeat Steps 1, 4, 5, 6, 7 for:

- `maker.ergsn.net` → application "Maker Review (laptop tunnel)"
- `buyer.ergsn.net` → application "Buyer Outreach (laptop tunnel)"

These will route through Cloudflare Tunnel to the laptop's port 5174/5175
in Phase 2. Gating them with the same policy means the laptop tools become
publicly addressable without exposing the laptop IP.

## Recovery — what to do if locked out

1. **Cloudflare account login (NOT Zero Trust login)** still works via your Cloudflare account email + 2FA. Open dashboard.
2. Zero Trust → Access → Applications → click `ERGSN Admin Hub` → **Edit** → **Disable application** (or remove the policy temporarily).
3. The admin hub at `admin.ergsn.net` is still gated by the Worker's JWT check, so disabling CF Access alone doesn't open it. To fully recover:
   - Use the X-Admin-Key fallback for the trade-docs Worker (the local-dev / recovery path) — call admin endpoints with `X-Admin-Key: <ADMIN_KEY secret value>` header from a tool like curl or admin-analytics.html.
   - This dual-auth design is intentional: CF Access is the daily entry, ADMIN_KEY is the recovery path. Never disable both at once.
4. The local tools (maker review, buyer review) keep working via their existing REVIEW_TOKEN URLs even when Access is broken.

## When you've finished Step 8

Tell the assistant "CF Access live" and we'll:
- remove the X-Admin-Key fallback from new admin endpoints (keep only as `?recovery=1` mode)
- re-add `_redirects` rules if needed
- onboard the Maker/Buyer tunnels (Phase 2)
