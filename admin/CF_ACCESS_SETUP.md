# Cloudflare Access setup runbook — admin.ergsn.net

One-time setup (~30 minutes) so `admin.ergsn.net` becomes a Zero-Trust gated
admin hub that only the owner email can reach. Performed in the Cloudflare
dashboard — **no terminal commands**. This runbook is here so the work
isn't lost between sessions.

> **Pre-flight: have a recovery path.** Add a SECONDARY email (different
> Google account, or a non-Google address) to the Access policy as a
> backup admin. If the primary Google account is compromised or its 2FA
> is lost, the secondary keeps you in. Without this you can lock yourself
> out.

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

After Phase 1 ships, this URL will serve `/admin/index.html` instead of the homepage (handled by `_routes.json`).

## Step 2 — Enable Cloudflare Zero Trust

1. Cloudflare dashboard → **Zero Trust** (left sidebar; if first time, accept the free plan, no card required)
2. Pick a **team name** (this becomes `<teamname>.cloudflareaccess.com`). Suggestion: `ergsn` if available.
3. **Settings → Authentication → Login methods → Add new**
   - Choose **Google**
   - For "owner-account-only" use, select **Configure** and use Google OAuth (it'll walk you through creating an OAuth Client ID + redirect URI in Google Cloud Console)
   - Test the integration via the "Test" button — should redirect to Google and back successfully
4. Same screen → **Disable** the One-time PIN method (a.k.a. magic-link). Email-based auth bypasses 2FA and is the weakest link. Keep only Google.

## Step 3 — Add the Application

1. Zero Trust → **Access → Applications → Add an application**
2. Type: **Self-hosted**
3. Application config:
   - Name: `ERGSN Admin Hub`
   - Session duration: **4 hours**
   - Application domain: subdomain `admin`, domain `ergsn.net`
   - Path: leave empty (whole subdomain is gated)
4. Identity providers: tick **only Google** (uncheck anything else)
5. Click **Next**

## Step 4 — Policy

1. Policy name: `Owner only`
2. Action: **Allow**
3. Configure rules:
   - Selector: `Emails`
   - Value: `jilee1212@gmail.com` (your primary)
   - Add another `Emails` row for the SECONDARY recovery email
4. **Additional settings**:
   - Session duration: 4 hours (already set)
   - Purpose justification: optional, you can leave off
   - Re-authentication: leave off for now (we can add per-step later when bulk-send actions need it)
5. Click **Next** → **Add Application**

## Step 5 — Verify the gate works

1. In a fresh incognito window: `https://admin.ergsn.net/`
2. Should redirect to Cloudflare Access login screen
3. Click "Sign in with Google" → log in with `jilee1212@gmail.com`
4. Should land on the admin hub (or whatever `/admin/index.html` becomes)
5. From a NON-allowed email (use a test Google account if you have one): should be denied with "You don't have permission".

If both work, you're done.

## Step 6 — Repeat for the local-tool subdomains (later, in Phase 2)

Repeat steps 1, 3-5 for:

- `maker.ergsn.net` → application "Maker Review (laptop tunnel)"
- `buyer.ergsn.net` → application "Buyer Outreach (laptop tunnel)"

These will route through Cloudflare Tunnel to the laptop's port 5174/5175
in Phase 2. Gating them with the same policy means the laptop tools become
publicly addressable without exposing the laptop IP.

## Recovery — what to do if locked out

1. **Cloudflare account login (NOT Zero Trust login)** still works via your Cloudflare account email + 2FA. Open dashboard.
2. Zero Trust → Access → Applications → click `ERGSN Admin Hub` → **Edit** → **Disable application** (or remove the policy).
3. The underlying admin hub at `admin.ergsn.net` becomes fully open. Do whatever recovery you need, then re-enable.
4. The local tools (maker review, buyer review) keep working via their existing REVIEW_TOKEN URLs even when Access is broken — that's the dual-auth fallback.

## When you've finished Step 5

Tell the assistant "Phase 0 done" and Phase 1 (admin hub page) will go live
on the existing ergsn.net build pipeline.
