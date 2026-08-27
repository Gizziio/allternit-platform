import { persistAuthSession } from "@/lib/auth/client";
import type { LoginResult, RegistrationStatus } from "./types";

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
	const response = await fetch("/api/setup/status", { cache: "no-store" });
	if (!response.ok) {
		throw new Error("Could not load registration status");
	}

	return (await response.json()) as RegistrationStatus;
}

export async function submitLogin(form: FormData): Promise<{ ok: boolean; data: LoginResult }> {
	const res = await fetch("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: form.get("email"),
			password: form.get("password"),
			turnstileToken: form.get("turnstileToken"),
		}),
	});

	return {
		ok: res.ok,
		data: (await persistAuthSession(res)) as LoginResult,
	};
}
