import { AuthGuard } from "@/components/auth/auth-guard";
import { OnboardingClient } from "./onboarding-client";

export default function OnboardingPage() {
	return (
		<AuthGuard>
			<OnboardingClient />
		</AuthGuard>
	);
}
