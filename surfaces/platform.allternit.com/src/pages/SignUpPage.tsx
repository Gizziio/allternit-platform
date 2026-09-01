import React from "react";
import { SignUp } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH } from "@/clerkConfig";
import { AuthPageShell } from "@/components/AuthPageShell";

const cleanCardAppearance = {
  elements: {
    headerTitle: { display: "none" },
    headerSubtitle: { display: "none" },
    logoBox: { display: "none" },
    footer: { display: "none" },
  },
} as const;

export function SignUpPage() {
  return (
    <AuthPageShell
      title="Get started with Allternit"
      subtitle="Create your account to start building with managed compute, billing, and API access."
    >
      <SignUp
        routing="path"
        path={CLERK_SIGN_UP_PATH}
        forceRedirectUrl="/"
        signInUrl={CLERK_SIGN_IN_PATH}
        signInForceRedirectUrl="/"
        appearance={cleanCardAppearance}
      />
      <div className="mt-6 border-t border-[#E8E6E1] pt-5 text-center text-[13px] text-[#5E5C56]">
        Already have an account?{" "}
        <Link
          to={CLERK_SIGN_IN_PATH}
          className="font-medium text-[#9A7658] underline underline-offset-2 transition-colors hover:text-[#1A1916]"
        >
          Sign in
        </Link>
      </div>
    </AuthPageShell>
  );
}
