import React from "react";
import { SignIn } from "@clerk/clerk-react";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH } from "@/clerkConfig";
import { AllternitWordmark } from "@/components/AllternitWordmark";

export function SignInPage() {
  return (
    <div className="clerk-page">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <AllternitWordmark variant="light" height={32} />
          <p className="mt-3 text-[14px] text-[var(--text-secondary)] max-w-xs">
            Sign in to the cloud console to manage compute, billing, and API access.
          </p>
        </div>
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
