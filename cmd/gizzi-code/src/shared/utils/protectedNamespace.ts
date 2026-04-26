/**
 * Canonical allowlist logic for protected namespaces.
 * Used for telemetry and safety gates in sensitive environments.
 */

export function checkProtectedNamespace(): boolean {
  // Check for K8s/COO signals
  const namespace = process.env.COO_NAMESPACE || process.env.K8S_NAMESPACE;
  if (!namespace) {
    return false;
  }

  // Open allowlist of non-protected namespaces
  const allowlist = [
    'default',
    'homespace',
    'dev',
    'test',
    'sandbox'
  ];

  if (allowlist.includes(namespace.toLowerCase())) {
    return false;
  }

  // If we have a namespace and it's not in the allowlist, assume protected
  return true;
}

export function isInProtectedNamespace(): boolean {
  return checkProtectedNamespace();
}
