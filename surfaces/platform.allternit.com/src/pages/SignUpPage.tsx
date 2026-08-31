import React from "react";
import { SignUp } from "@clerk/clerk-react";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH } from "@/clerkConfig";
import { AllternitWordmark } from "@/components/AllternitWordmark";

export function SignUpPage() {
  return (
    <div className="clerk-page">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <AllternitWordmark variant="dark" height={32} />
          <p className="mt-3 text-[14px] text-[var(--text-secondary)] max-w-xs">
            Create your Allternit account to start building with managed compute and APIs.
          </p>
        </div>
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
