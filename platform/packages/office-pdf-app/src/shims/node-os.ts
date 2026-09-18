/** node:os shim — the vendored code only needs a user/home. */
export function userInfo() {
  return { username: 'allternit', homedir: '/virtual' }
}
export function homedir(): string {
  return '/virtual'
}
export function tmpdir(): string {
  return '/virtual/tmp'
}
export function platform(): string {
  return 'darwin'
}
