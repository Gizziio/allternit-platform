"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import type { ProfileFormProps, ProfileFormResponse } from "./types";

export function ProfileForm({ initialName, initialResetEmail, email }: ProfileFormProps) {
	const [name, setName] = useState(initialName);
	const [resetEmail, setResetEmail] = useState(initialResetEmail);
	const [savedName, setSavedName] = useState(initialName);
	const [savedResetEmail, setSavedResetEmail] = useState(initialResetEmail);
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const hasChanges = name.trim() !== savedName || resetEmail.trim() !== savedResetEmail;

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setStatus(null);

		const res = await authFetch("/api/settings/profile", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, resetEmail }),
		});
		const data = (await res.json()) as ProfileFormResponse;
		setLoading(false);

		if (!res.ok) {
			setStatus(typeof data.error === "string" ? data.error : "Failed to update account");
			return;
		}

		const nextName = data.user?.name ?? name.trim();
		const nextResetEmail = data.user?.resetEmail ?? "";
		setName(nextName);
		setResetEmail(nextResetEmail);
		setSavedName(nextName);
		setSavedResetEmail(nextResetEmail);
		setStatus("Saved");
	}

	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
			</div>
			<div className="space-y-2">
				<Label htmlFor="resetEmail">Recovery email</Label>
				<Input
					id="resetEmail"
					value={resetEmail}
					onChange={(event) => setResetEmail(event.target.value)}
					type="email"
					placeholder="recovery@example.com"
				/>
			</div>
			<div className="space-y-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
				<Label>Account email</Label>
				<p className="text-sm text-neutral-700">{email}</p>
			</div>
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={loading || !hasChanges}>
					{loading ? "Saving..." : "Save"}
				</Button>
				{status && <p className="text-sm text-neutral-500">{status}</p>}
			</div>
		</form>
	);
}
