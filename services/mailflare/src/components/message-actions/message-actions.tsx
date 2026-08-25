"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Mail, MailOpen, MoreVertical, Reply, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import type { MessageActionsProps } from "./types";
import {
	confirmTrashWithoutUnsubscribe,
	createTrashSenderRule,
	getMessageActionRedirect,
	openUnsubscribeUrl,
	runSingleMessageAction,
} from "./utils";

export function MessageActions({
	messageId,
	mailboxId,
	senderAddress,
	direction,
	status,
	read,
	unsubscribeUrl,
}: MessageActionsProps) {
	const router = useRouter();
	const [pendingAction, setPendingAction] = useState<BulkMessageAction | "unsubscribe" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [moreOpen, setMoreOpen] = useState(false);

	async function runAction(action: BulkMessageAction) {
		setMoreOpen(false);
		setPendingAction(action);
		setError(null);
		try {
			await runSingleMessageAction(messageId, action);
			const redirect = getMessageActionRedirect(action, direction);
			if (redirect) router.push(redirect);
			router.refresh();
		} catch {
			setError("Could not update message");
		} finally {
			setPendingAction(null);
		}
	}

	async function onUnsubscribe() {
		setMoreOpen(false);
		setError(null);
		if (unsubscribeUrl) {
			openUnsubscribeUrl(unsubscribeUrl);
			return;
		}

		if (!confirmTrashWithoutUnsubscribe()) return;
		setPendingAction("unsubscribe");
		if (!mailboxId) {
			setError("Could not create trash rule");
			setPendingAction(null);
			return;
		}

		try {
			await createTrashSenderRule({ mailboxId, senderAddress });
			await runAction("trash");
		} catch {
			setError("Could not create trash rule");
			setPendingAction(null);
		}
	}

	const disabled = pendingAction !== null;
	const markAction: BulkMessageAction = read ? "unread" : "read";

	return (
		<div className="flex items-center gap-3 text-neutral-600">
			{error && <span className="text-xs text-red-600">{error}</span>}
			<div className="flex items-center gap-2">
				<Tooltip label="Reply">
					<Button type="button" variant="ghost" size="sm" aria-label="Reply">
						<Reply className="h-5 w-5" />
					</Button>
				</Tooltip>
				<Tooltip label="Archive">
					<Button
						variant="ghost"
						size="sm"
						aria-label="Archive"
						disabled={disabled || status === "archived"}
						onClick={() => runAction("archive")}
					>
						<Archive className="h-5 w-5" />
					</Button>
				</Tooltip>
				<Tooltip label="Report spam">
					<Button
						variant="ghost"
						size="sm"
						aria-label="Report spam"
						disabled={disabled || status === "spam" || direction !== "inbound"}
						onClick={() => runAction("spam")}
					>
						<ShieldAlert className="h-5 w-5" />
					</Button>
				</Tooltip>
				<Tooltip label="Delete">
					<Button
						variant="ghost"
						size="sm"
						aria-label="Move to trash"
						disabled={disabled || status === "trash"}
						onClick={() => runAction("trash")}
					>
						<Trash2 className="h-5 w-5" />
					</Button>
				</Tooltip>
				<Tooltip label={read ? "Mark as unread" : "Mark as read"}>
					<Button
						variant="ghost"
						size="sm"
						aria-label={read ? "Mark as unread" : "Mark as read"}
						disabled={disabled}
						onClick={() => runAction(markAction)}
					>
						{read ? <Mail className="h-5 w-5" /> : <MailOpen className="h-5 w-5" />}
					</Button>
				</Tooltip>
				<div className="relative">
					<Tooltip label="More actions">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-label="More actions"
							aria-expanded={moreOpen}
							disabled={disabled}
							onClick={() => setMoreOpen((open) => !open)}
						>
							<MoreVertical className="h-5 w-5" />
						</Button>
					</Tooltip>
					{moreOpen && (
						<div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
							{direction === "inbound" && (
								<button
									type="button"
									className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
									disabled={!unsubscribeUrl && status === "trash"}
									onClick={() => void onUnsubscribe()}
								>
									Unsubscribe
								</button>
							)}
							<label className="mt-1 block px-3 text-xs font-medium text-neutral-500" htmlFor={`move-message-${messageId}`}>
								Move to
							</label>
							<select
								id={`move-message-${messageId}`}
								className="mt-1 h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-700"
								defaultValue=""
								aria-label="Move message"
								onChange={(event) => {
									if (!event.target.value) return;
									void runAction(event.target.value as BulkMessageAction);
									event.target.value = "";
								}}
							>
								<option value="">Select folder...</option>
								{status === "archived" && direction === "inbound" && (
									<option value="inbox">Inbox</option>
								)}
								{status !== "archived" && <option value="archive">Archived</option>}
								<option value="spam">Spam</option>
								<option value="trash">Trash</option>
							</select>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
