#!/usr/bin/env bash
set -euo pipefail

: "${CLERK_SECRET_KEY:?CLERK_SECRET_KEY is required}"
: "${CLERK_OWNER_EMAIL:?CLERK_OWNER_EMAIL is required}"

CLERK_ORGANIZATION_NAME="${CLERK_ORGANIZATION_NAME:-Allternit}"
CLERK_ORGANIZATION_SLUG="${CLERK_ORGANIZATION_SLUG:-allternit}"
CLERK_API_BASE="${CLERK_API_BASE:-https://api.clerk.com/v1}"

request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local response
  local status

  response="$(mktemp)"
  if [[ -n "$payload" ]]; then
    status="$(curl --silent --show-error \
      --request "$method" \
      --header "Authorization: Bearer ${CLERK_SECRET_KEY}" \
      --header 'Content-Type: application/json' \
      --data "$payload" \
      --output "$response" \
      --write-out '%{http_code}' \
      "${CLERK_API_BASE}${path}")"
  else
    status="$(curl --silent --show-error \
      --request "$method" \
      --header "Authorization: Bearer ${CLERK_SECRET_KEY}" \
      --header 'Content-Type: application/json' \
      --output "$response" \
      --write-out '%{http_code}' \
      "${CLERK_API_BASE}${path}")"
  fi

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    printf 'Clerk API request failed: %s %s (HTTP %s)\n' "$method" "$path" "$status" >&2
    jq '{errors, clerk_trace_id}' "$response" >&2 2>/dev/null || sed -n '1,40p' "$response" >&2
    rm -f "$response"
    return 1
  fi

  cat "$response"
  rm -f "$response"
}

# Allternit serves both personal/local-compute users and enterprise teams, so
# Organizations are enabled without synthesizing an organization for every
# solo account. Clerk's existing Personal Accounts choice remains untouched.
request PATCH /instance/organization_settings \
  '{"enabled":true,"max_allowed_memberships":100,"admin_delete_enabled":false}' >/dev/null

users="$(request GET '/users?limit=500&order_by=-created_at')"
owner_user_id="$(
  jq -r --arg email "$CLERK_OWNER_EMAIL" '
    [ .[]
      | select(any(.email_addresses[]?; (.email_address | ascii_downcase) == ($email | ascii_downcase)))
      | .id
    ]
    | if length == 1 then .[0] else empty end
  ' <<<"$users"
)"

if [[ -z "$owner_user_id" ]]; then
  match_count="$(
    jq -r --arg email "$CLERK_OWNER_EMAIL" '
      [ .[] | select(any(.email_addresses[]?; (.email_address | ascii_downcase) == ($email | ascii_downcase))) ] | length
    ' <<<"$users"
  )"
  printf 'Expected exactly one Clerk user for %s; found %s.\n' "$CLERK_OWNER_EMAIL" "$match_count" >&2
  exit 1
fi

organizations="$(request GET '/organizations?limit=500&order_by=-created_at')"
organization_id="$(
  jq -r --arg slug "$CLERK_ORGANIZATION_SLUG" '
    [ .data[]? | select(.slug == $slug) | .id ]
    | if length == 1 then .[0] else empty end
  ' <<<"$organizations"
)"

if [[ -z "$organization_id" ]]; then
  organization_payload="$(jq -cn \
    --arg name "$CLERK_ORGANIZATION_NAME" \
    --arg slug "$CLERK_ORGANIZATION_SLUG" \
    --arg created_by "$owner_user_id" \
    '{name:$name, slug:$slug, created_by:$created_by, max_allowed_memberships:100}')"
  organization="$(request POST /organizations "$organization_payload")"
  organization_id="$(jq -r '.id' <<<"$organization")"
  action='created'
else
  organization_payload="$(jq -cn \
    --arg name "$CLERK_ORGANIZATION_NAME" \
    --arg slug "$CLERK_ORGANIZATION_SLUG" \
    '{name:$name, slug:$slug, max_allowed_memberships:100}')"
  request PATCH "/organizations/${organization_id}" "$organization_payload" >/dev/null
  action='updated'
fi

memberships="$(request GET "/organizations/${organization_id}/memberships?limit=500")"
membership_count="$(
  jq -r --arg user_id "$owner_user_id" '
    [ .data[]? | select(.public_user_data.user_id == $user_id) ] | length
  ' <<<"$memberships"
)"
role_payload='{"role":"org:admin"}'

if [[ "$membership_count" -eq 0 ]]; then
  membership_payload="$(jq -cn --arg user_id "$owner_user_id" \
    '{user_id:$user_id, role:"org:admin"}')"
  request POST "/organizations/${organization_id}/memberships" "$membership_payload" >/dev/null
else
  request PATCH "/organizations/${organization_id}/memberships/${owner_user_id}" "$role_payload" >/dev/null
fi

# Record the commercial owner server-side. Runtime authorization continues to
# use the signed `org:admin` role, which includes Clerk's billing permissions.
metadata_payload="$(jq -cn --arg owner_user_id "$owner_user_id" \
  '{private_metadata:{billing_owner_user_id:$owner_user_id,billing_access:"owner_admin"}}')"
request PATCH "/organizations/${organization_id}/metadata" "$metadata_payload" >/dev/null

membership="$(request GET "/organizations/${organization_id}/memberships?limit=500" \
  | jq -c --arg user_id "$owner_user_id" \
      '.data[] | select(.public_user_data.user_id == $user_id)')"

if [[ "$(jq -r '.role' <<<"$membership")" != 'org:admin' ]]; then
  printf 'Owner membership was not promoted to org:admin.\n' >&2
  exit 1
fi

printf 'Clerk organization %s: %s (%s); owner role: %s; organization membership: enabled.\n' \
  "$action" "$CLERK_ORGANIZATION_NAME" "$CLERK_ORGANIZATION_SLUG" \
  "$(jq -r '.role' <<<"$membership")"
