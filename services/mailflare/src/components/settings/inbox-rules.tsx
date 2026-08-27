"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, Route, ShieldAlert, Trash2 } from "lucide-react";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	createInboxRule,
	deleteInboxRule,
	fetchInboxRules,
	fetchRuleFolders,
	getRuleFieldLabel,
	getRuleOperatorLabel,
} from "./inbox-rules-utils";

export function InboxRules() {
	const queryClient = useQueryClient();
	const { selectedMailbox } = useSelectedMailbox();
	const [matchField, setMatchField] = useState<"email" | "content" | "title">("email");
	const [matchOperator, setMatchOperator] = useState<"contains" | "exact">("contains");
	const [matchValue, setMatchValue] = useState("");
	const [destination, setDestination] = useState("");
	const mailboxId = selectedMailbox?.id ?? "";

	const folders = useQuery({
		queryKey: ["folders", mailboxId],
		enabled: !!mailboxId,
		queryFn: () => fetchRuleFolders(mailboxId),
	});
	const rules = useQuery({
		queryKey: ["routing-rules", mailboxId],
		enabled: !!mailboxId,
		queryFn: () => fetchInboxRules(mailboxId),
	});

	const create = useMutation({
		mutationFn: () => createInboxRule({
			mailboxId,
			matchField,
			matchOperator,
			matchValue,
			destination,
			priority: 10,
		}),
		onSuccess: () => {
			setMatchField("email");
			setMatchOperator("contains");
			setMatchValue("");
			setDestination("");
			queryClient.invalidateQueries({ queryKey: ["routing-rules", mailboxId] });
		},
	});
	const remove = useMutation({
		mutationFn: deleteInboxRule,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routing-rules", mailboxId] }),
	});

	const folderMap = new Map((folders.data?.folders ?? []).map((folder) => [folder.id, folder.name]));

	function getRuleDestination(rule: { action: string; folderId: string | null }) {
		if (rule.action === "spam") return "Spam";
		if (rule.action === "trash") return "Trash";
		return folderMap.get(rule.folderId ?? "") ?? "Unknown folder";
	}

	return (
		<section>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Route className="h-4 w-4" />
						New rule
					</CardTitle>
					<CardDescription>Choose what to match and where the message should go.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
						<div className="space-y-2">
							<Label htmlFor="matchField">Field</Label>
							<select
								id="matchField"
								className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
								value={matchField}
								onChange={(event) => setMatchField(event.target.value as "email" | "content" | "title")}
							>
								<option value="email">Email address</option>
								<option value="content">Content</option>
								<option value="title">Title</option>
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="matchOperator">Match</Label>
							<select
								id="matchOperator"
								className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
								value={matchOperator}
								onChange={(event) => setMatchOperator(event.target.value as "contains" | "exact")}
							>
								<option value="contains">Contains</option>
								<option value="exact">Exact match</option>
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="matchValue">Value</Label>
							<Input
								id="matchValue"
								value={matchValue}
								onChange={(event) => setMatchValue(event.target.value)}
								placeholder={matchField === "email" ? "sender@example.com" : "Invoice"}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="destination">Destination</Label>
						<select
							id="destination"
							className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
							value={destination}
							onChange={(event) => setDestination(event.target.value)}
						>
							<option value="">Select destination</option>
							<option value="spam">Spam</option>
							<option value="trash">Trash</option>
							{(folders.data?.folders ?? []).map((folder) => (
								<option key={folder.id} value={`folder:${folder.id}`}>
									{folder.name}
								</option>
							))}
						</select>
					</div>
					{create.isError && <p className="text-sm text-red-600">{create.error.message}</p>}
					<Button
						onClick={() => create.mutate()}
						disabled={!mailboxId || !destination || !matchValue.trim() || create.isPending}
					>
						{create.isPending ? "Adding..." : "Add rule"}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Existing rules</CardTitle>
				</CardHeader>
				<CardContent>
					{(rules.data?.rules ?? []).length === 0 && (
						<p className="rounded-lg border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500">
							No rules yet
						</p>
					)}
					<div className="divide-y divide-neutral-100">
						{(rules.data?.rules ?? []).map((rule) => (
							<div key={rule.id} className="flex items-center gap-3 py-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
									{rule.action === "spam" ? (
										<ShieldAlert className="h-4 w-4" />
									) : rule.action === "trash" ? (
										<Trash2 className="h-4 w-4" />
									) : (
										<Folder className="h-4 w-4" />
									)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-neutral-900">
										{getRuleFieldLabel(rule.matchField)} {getRuleOperatorLabel(rule.matchOperator)}{" "}
										{rule.matchValue || rule.pattern}
									</p>
									<p className="truncate text-xs text-neutral-500">{getRuleDestination(rule)}</p>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={remove.isPending}
									onClick={() => remove.mutate(rule.id)}
									aria-label="Delete rule"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</section>
	);
}
