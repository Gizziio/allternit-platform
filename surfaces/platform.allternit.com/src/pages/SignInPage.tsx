import React from "react";
import { SignIn } from "@clerk/clerk-react";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH } from "@/clerkConfig";

export function SignInPage() {
  return (
    <div className="clerk-page">
      <div className="w-full max-w-md">
        <SignIn
          routing="path"
          path={CLERK_SIGN_IN_PATH}
          forceRedirectUrl="/"
          signUpUrl={CLERK_SIGN_UP_PATH}
          signUpForceRedirectUrl="/"
        />
      </div>
    </div>
  );
}
