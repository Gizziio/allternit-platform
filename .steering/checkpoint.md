# Steering checkpoint — session/office-host2

Goal: Stop the hosted Office add-ins from being clobbered by competing deploys.

Just did:
- Root cause of the recurring breakage: two pipelines deploy to the same Pages project `allternit-platform` — this repo's CI AND the allternit-websites "platform export" (deployments with commit_message "sync: platform export", commit_dirty=true, commits not in git). Whichever deploys last wins; the export serves stale content (XFO DENY era _headers, no office-addins).
- Created isolated Pages project `allternit-office-addins` + custom domain office-addins.allternit.com (domain pending: API token lacks DNS edit; CNAME must be added in the dashboard).
- Deployed the verified-good build there manually (lifted from deployment a0e52aab); manifests rewritten to https://allternit-office-addins.pages.dev/office-addins; strengthened test:hosted PASSES; MS validator: valid.
- Workflow: add-in build env now targets the new origin; new stage + deploy steps publish the runtime to the isolated project on every merge.

Next: PR + merge; confirm CI deploys green to the new project; user re-uploads word.xml in Word on the web and runs the acceptance checklist; Excel + PowerPoint after.

Open questions:
- DNS: need CNAME office-addins.allternit.com -> allternit-office-addins.pages.dev (dashboard; token lacks Zone.DNS). Until then manifests use the pages.dev origin.
