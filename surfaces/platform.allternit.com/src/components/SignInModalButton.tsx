import React from "react";
import { Link } from "react-router-dom";
import { useClerk } from "@/lib/platform-auth-client";

interface SignInModalButtonProps {
  redirectUrl?: string;
  children: React.ReactNode;
  className?: string;
  mode?: "sign-in" | "sign-up";
}

export function SignInModalButton({
  redirectUrl = "/",
  children,
  className,
  mode = "sign-in",
}: SignInModalButtonProps) {
  const clerk = useClerk();

  if (!clerk) {
    const href = `/${mode === "sign-in" ? "sign-in" : "sign-up"}?redirect_url=${encodeURIComponent(
      redirectUrl
    )}`;
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (mode === "sign-up") {
          clerk.openSignUp?.({ redirectUrl });
        } else {
          clerk.openSignIn?.({ redirectUrl });
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}
