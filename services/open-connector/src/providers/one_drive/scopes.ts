export const oneDriveProviderScopes = {
  userRead: "User.Read",
  filesRead: "Files.Read",
  filesReadWrite: "Files.ReadWrite",
  filesReadAll: "Files.Read.All",
  filesReadWriteAll: "Files.ReadWrite.All",
  offlineAccess: "offline_access",
} as const;

export const oneDriveReadScopes: string[] = [oneDriveProviderScopes.filesRead];
export const oneDriveWriteScopes: string[] = [oneDriveProviderScopes.filesReadWrite];
export const oneDriveOAuthScopes: string[] = [
  oneDriveProviderScopes.userRead,
  oneDriveProviderScopes.filesReadWrite,
  oneDriveProviderScopes.offlineAccess,
];
