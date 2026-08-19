import { AuthGuard } from "@/components/auth/auth-guard";
import { RegisterClient } from "./register-client";

export default function RegisterPage() {
	return (
		<AuthGuard mode="public">
			<RegisterClient />
		</AuthGuard>
	);
}
