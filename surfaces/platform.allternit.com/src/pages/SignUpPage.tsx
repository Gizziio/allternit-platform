import React from "react";
import { SignUp } from "@clerk/clerk-react";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH } from "@/clerkConfig";

export function SignUpPage() {
  return (
    <div className="clerk-page">
      <div className="w-full max-w-md">
        <SignUp
          routing="path"
          path={CLERK_SIGN_UP_PATH}
          forceRedirectUrl="/"
          signInUrl={CLERK_SIGN_IN_PATH}
          signInForceRedirectUrl="/"
        />
      </div>
    </div>
  );
}
