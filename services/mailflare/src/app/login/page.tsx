import { AuthGuard } from "@/components/auth/auth-guard";
import { LoginClient } from "./login-client";

export default function LoginPage() {
	return (
		<AuthGuard mode="public">
			<LoginClient />
		</AuthGuard>
	);
}
