export const googleTasksReadonlyScope = "https://www.googleapis.com/auth/tasks.readonly";
export const googleTasksFullScope = "https://www.googleapis.com/auth/tasks";
export const googleOpenIdScope = "openid";
export const googleEmailScope = "email";
export const googleProfileScope = "profile";

export const googleTasksReadScopes: string[] = [googleTasksReadonlyScope];
export const googleTasksWriteScopes: string[] = [googleTasksFullScope];
export const googleTasksOAuthScopes: string[] = [
  googleTasksReadonlyScope,
  googleTasksFullScope,
  googleOpenIdScope,
  googleEmailScope,
  googleProfileScope,
];
