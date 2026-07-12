export const presentationsReadonlyScope = "https://www.googleapis.com/auth/presentations.readonly";
export const presentationsScope = "https://www.googleapis.com/auth/presentations";
export const googleDriveReadonlyScope = "https://www.googleapis.com/auth/drive.readonly";
export const googleDriveFullScope = "https://www.googleapis.com/auth/drive";
export const googleOpenIdScope = "openid";
export const googleEmailScope = "email";
export const googleProfileScope = "profile";

export const googleSlidesReadScopes: string[] = [presentationsReadonlyScope, googleDriveReadonlyScope];
export const googleSlidesWriteScopes: string[] = [presentationsScope, googleDriveFullScope];
export const googleSlidesOAuthScopes: string[] = [
  presentationsReadonlyScope,
  presentationsScope,
  googleDriveReadonlyScope,
  googleDriveFullScope,
  googleOpenIdScope,
  googleEmailScope,
  googleProfileScope,
];
