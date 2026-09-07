# Steering checkpoint — session/office-appdomains

Goal: Fix "domain not included in AppDomains" error when connecting Allternit from the hosted Office add-in.

Just did: connectAllternit opens platform.allternit.com/office-auth-bridge via displayDialogAsync; that flow signs in through Clerk (clerk.allternit.com / *.clerk.dev / *.accounts.dev / challenges.cloudflare.com), which Office blocked. Added those AppDomains to manifest.host.template.xml, bumped manifests to 1.1.2.0, regenerated + validated (MS validator: valid), deployed to the isolated allternit-office-addins project (CI still blocked by another session's lockfile breakage), refreshed owner's Desktop copies.

Next: PR + merge; owner re-uploads word.xml (remove old entry first) and retries Connect Allternit; then Excel/PowerPoint; then the task pane UI makeover (owner request).
