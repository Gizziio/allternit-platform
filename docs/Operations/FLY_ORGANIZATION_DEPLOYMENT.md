# Fly organization deployment procedure

Allternit's hosted customer runtimes live in the dedicated Fly organization
with slug `allternit`. The shared Cloud API currently remains in the existing
`personal` organization and provisions Machines in `allternit` through an
organization-scoped token.

## One-time organization setup

```bash
fly auth login
fly orgs create Allternit
fly orgs show allternit
```

Add a payment method to the `Allternit` organization in the Fly dashboard
before launching the first customer runtime. Keep the Cloud API and hosted
runtime costs in this organization separate when the Cloud API is moved later.

Create a short-lived organization token and stage it directly on the Cloud API.
Do not use a personal authentication token and do not print or commit the token.

```bash
FLY_RUNTIME_TOKEN="$(fly tokens create org \
  --org allternit \
  --name allternit-cloud-api-hosted-runtime \
  --expiry 8760h \
  --json | jq -r '.token // .Token')"

fly secrets set --stage --app allternit-cloud-api \
  FLY_API_TOKEN="$FLY_RUNTIME_TOKEN"
unset FLY_RUNTIME_TOKEN
```

`FLY_ORG_SLUG=allternit` is deliberately committed in the root `fly.toml`.
The billing-sync secret remains an encrypted Fly secret.

## Deploy the Cloud API

The repository's `FLY_API_TOKEN` GitHub Actions secret is a deploy token for
`allternit-cloud-api`; it is separate from the runtime-provisioning token above.

```bash
fly tokens create deploy --app allternit-cloud-api --expiry 8760h
gh secret set FLY_API_TOKEN
gh workflow run deploy-cloud-api-fly.yml --ref main
gh run watch --exit-status
```

Normal pushes that change `cmd/allternit-cloud-api/**`, `Cargo.toml`,
`Cargo.lock`, or `fly.toml` run the same workflow automatically.

## Publish the hosted runtime image

Pushes that change `cmd/allternit-hosted-runtime/**` run
`publish-hosted-runtime.yml`. The workflow publishes both the commit SHA and
`latest` tags to:

```text
ghcr.io/gizziio/allternit-hosted-runtime
```

The package must be publicly readable so Fly Machines in the customer runtime
organization can pull it without registry credentials.

## Verify

```bash
curl --fail https://allternit-cloud-api.fly.dev/api/v1/health/live
fly status --app allternit-cloud-api
fly apps list --org allternit
fly secrets list --app allternit-cloud-api
```

Rotate the organization token at least annually, immediately on suspected
exposure, and whenever the Cloud API's provisioning authority changes.
