"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useCompose } from "@/components/compose/compose-context";
import { useMailSearch } from "@/components/mail-search/mail-search-context";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { useMessageCounts } from "@/hooks/use-message-counts";
import { useMessages } from "@/hooks/use-messages";
import type { BulkMessageAction } from "@/app/api/messages/bulk/types";
import { setMessageDragData } from "@/lib/messages/drag-utils";
import { BulkMessageToolbar } from "./bulk-message-toolbar";
import type { MessageFolderPageProps, MessageListRowProps } from "./types";
import {
	formatMessageListTimestamp,
	getPageRange,
	getMessageBadge,
	getMessageParty,
	getMessagePartyClassName,
	getMessagePreview,
	formatEmailPageTitle,
	getMailboxAddress,
	runBulkMessageAction,
} from "./utils";

const pageSize = 25;

function MessageListRow({
	message,
	config,
	selected,
	active = false,
	compact = false,
	onSelectedChange,
	dragMessageIds,
}: MessageListRowProps) {
	const Icon = config.icon;
	const { openDraftComposer } = useCompose();
	const unread = message.direction === "inbound" && !message.read;
	const draggable = config.folder === "inbox" && message.direction === "inbound";
	const party = getMessageParty(message, config.folder);
	const preview = getMessagePreview(message, config.folder);
	const href = `${config.hrefPrefix}/${message.id}`;

	if (compact && config.folder !== "drafts") {
		return (
			<div
				className={`group grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-l-2 px-4 py-3 transition-colors ${
					active
						? "border-l-blue-600 bg-blue-50"
						: selected
							? "border-l-transparent bg-neutral-50"
							: "border-l-transparent hover:bg-neutral-50"
				} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
				draggable={draggable}
				onDragStart={(event) => {
					if (!draggable) return;
					setMessageDragData(event.dataTransfer, { messageIds: dragMessageIds });
				}}
			>
				<input
					type="checkbox"
					checked={selected}
					onChange={(event) => onSelectedChange(message.id, event.target.checked)}
					className="mt-1 h-4 w-4 rounded border-neutral-300"
					aria-label={`Select message from ${party}`}
				/>
				<Link href={href} className="min-w-0">
					<span className="flex items-baseline justify-between gap-3">
						<span className={getMessagePartyClassName(message, config.folder)}>
							{party}
						</span>
						<span className="shrink-0 text-[11px] text-neutral-400">
							{formatMessageListTimestamp(message.createdAt)}
						</span>
					</span>
					<span
						className={`mt-1 block truncate text-sm ${
							unread ? "font-semibold text-neutral-900" : "text-neutral-700"
						}`}
					>
						{message.subject ?? "(no subject)"}
					</span>
					<span className="mt-0.5 block truncate text-xs leading-5 text-neutral-500">
						{preview}
					</span>
				</Link>
			</div>
		);
	}

	const className =
		`grid min-h-12 w-full grid-cols-[24px_32px_minmax(160px,240px)_1fr_auto] items-center gap-3 px-6 text-left text-sm hover:relative hover:z-10 hover:bg-[#f2f6fc] hover:shadow-sm ${
			active || selected ? "bg-blue-50" : ""
		} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`;
	const content = (
		<>
			<Icon className="h-4 w-4 text-neutral-300" />
			<span className={getMessagePartyClassName(message, config.folder)}>
				{getMessageParty(message, config.folder)}
			</span>
			<span className="truncate text-neutral-700">
				<span className={unread ? "font-bold text-neutral-900" : ""}>
					{message.subject ?? "(no subject)"}
				</span>
				<span className="text-neutral-500"> - {getMessagePreview(message, config.folder)}</span>
			</span>
			{config.showRowBadge !== false && (
				<Badge variant={config.badgeVariant ?? "secondary"}>
					{getMessageBadge(message, config.folder)}
				</Badge>
			)}
		</>
	);

	if (config.folder === "drafts") {
		return (
			<div className={className}>
				<input
					type="checkbox"
					checked={selected}
					onChange={(event) => onSelectedChange(message.id, event.target.checked)}
					className="h-4 w-4 rounded border-neutral-300"
					aria-label="Select message"
				/>
				<button type="button" className="contents text-left" onClick={() => openDraftComposer(message.id)}>
					{content}
				</button>
			</div>
		);
	}

	return (
		<div
			className={className}
			draggable={draggable}
			onDragStart={(event) => {
				if (!draggable) return;
				setMessageDragData(event.dataTransfer, { messageIds: dragMessageIds });
			}}
		>
			<input
				type="checkbox"
				checked={selected}
				onChange={(event) => onSelectedChange(message.id, event.target.checked)}
				className="h-4 w-4 rounded border-neutral-300"
				aria-label="Select message"
			/>
			<Link href={href} className="contents">
				{content}
			</Link>
		</div>
	);
}

export function MessageFolderPage({
	config,
	compact = false,
	selectedMessageId,
	selection,
}: MessageFolderPageProps) {
	const { selectedMailbox, isLoading: mailboxesLoading } = useSelectedMailbox();
	const { query } = useMailSearch();
	const [offset, setOffset] = useState(0);
	const [internalSelectedMessages, setInternalSelectedMessages] = useState<
		Array<{ id: string; read: boolean }>
	>([]);
	const [pendingBulkAction, setPendingBulkAction] = useState(false);
	const { messages, isLoading, total, limit } = useMessages(config.folder, selectedMailbox?.id, {
		query,
		limit: pageSize,
		offset,
	}, !mailboxesLoading, config.folderId);
	const { counts } = useMessageCounts(selectedMailbox?.id, !mailboxesLoading);
	const headerIcons = config.headerIcons ?? [];
	const hasActiveFilters = !!query.trim();
	const folderCount = config.folderId
		? counts.customFolders[config.folderId]
		: counts.folders[config.folder];
	const titleTotal = folderCount?.total ?? total;
	const titleUnread = folderCount?.unread ?? 0;
	const mailboxAddress = getMailboxAddress(selectedMailbox);
	const pageRange = getPageRange(offset, messages.length, total);
	const selectedMessages = selection?.selectedMessages ?? internalSelectedMessages;
	const setSelectedMessages =
		selection?.setSelectedMessages ?? setInternalSelectedMessages;
	const selectedIds = useMemo(
		() => selectedMessages.map((message) => message.id),
		[selectedMessages],
	);
	const hasUnreadSelection = selectedMessages.some((message) => !message.read);
	const allVisibleSelected = messages.length > 0 && messages.every((message) => selectedIds.includes(message.id));

	useEffect(() => {
		setOffset(0);
		setSelectedMessages([]);
	}, [query, selectedMailbox?.id, config.folder, config.folderId]);

	useEffect(() => {
		setSelectedMessages([]);
	}, [offset]);

	useEffect(() => {
		if (mailboxesLoading) return;
		document.title = formatEmailPageTitle({
			location: config.title,
			total: titleTotal,
			unread: titleUnread,
			emailAddress: mailboxAddress,
		});
	}, [config.title, mailboxAddress, mailboxesLoading, titleTotal, titleUnread]);

	function updateSelectedMessage(messageId: string, selected: boolean) {
		const message = messages.find((item) => item.id === messageId);
		if (!message) return;

		setSelectedMessages((current) => {
			if (!selected) return current.filter((item) => item.id !== messageId);
			if (current.some((item) => item.id === messageId)) return current;
			return [...current, { id: message.id, read: message.read }];
		});
	}

	function toggleAllVisible(selected: boolean) {
		const visibleIds = new Set(messages.map((message) => message.id));
		setSelectedMessages((current) => {
			if (!selected) {
				return current.filter((message) => !visibleIds.has(message.id));
			}

			const next = new Map(current.map((message) => [message.id, message]));
			for (const message of messages) {
				next.set(message.id, { id: message.id, read: message.read });
			}
			return Array.from(next.values());
		});
	}

	async function runSelectedAction(action: BulkMessageAction) {
		if (selectedIds.length === 0) return;

		setPendingBulkAction(true);
		try {
			await runBulkMessageAction(selectedIds, action);
			setSelectedMessages([]);
		} finally {
			setPendingBulkAction(false);
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className={`flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 ${compact ? "px-4" : "px-6"}`}>
				<div className="flex items-center gap-3 w-full">
					<Tooltip label="Select all visible messages">
						<input
							type="checkbox"
							checked={allVisibleSelected}
							disabled={messages.length === 0}
							onChange={(event) => toggleAllVisible(event.target.checked)}
							className="h-4 w-4 rounded border-neutral-300"
							aria-label="Select all visible messages"
						/>
					</Tooltip>
					{selectedIds.length > 0 && !compact ? (
						<BulkMessageToolbar
							selectedCount={selectedIds.length}
							hasUnreadSelection={hasUnreadSelection}
							onAction={runSelectedAction}
							onClearSelection={() => setSelectedMessages([])}
							pending={pendingBulkAction}
						/>
					) : (
						compact && (
							<>
								{/* <h1 className="truncate text-sm font-semibold text-neutral-900">
									{config.title}
								</h1>
								<Badge variant="secondary">{total}</Badge> */}
							</>
						)
					)}
				</div>
				{(selectedIds.length === 0 || compact) && (
					<div className="flex items-center gap-2 text-neutral-500">
						<span className="text-xs text-neutral-500 whitespace-nowrap">
							{pageRange.start} - {pageRange.end} of {pageRange.total}
						</span>
						<Tooltip label="Previous page">
							<Button
								variant="ghost"
								size="sm"
								disabled={offset === 0 || isLoading}
								onClick={() => setOffset(Math.max(offset - limit, 0))}
								aria-label="Previous page"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
						</Tooltip>
						<Tooltip label="Next page">
							<Button
								variant="ghost"
								size="sm"
								disabled={offset + messages.length >= total || isLoading}
								onClick={() => setOffset(offset + limit)}
								aria-label="Next page"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</Tooltip>
						{!compact && headerIcons.map((Icon, index) => (
							<Icon key={index} className="h-4 w-4" />
						))}
					</div>
				)}
			</div>

			<div className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto overscroll-contain scrollbar-gutter-stable">
				{messages.map((message) => (
					<MessageListRow
						key={message.id}
						message={message}
						config={config}
						selected={selectedIds.includes(message.id)}
						active={message.id === selectedMessageId}
						compact={compact}
						onSelectedChange={updateSelectedMessage}
						dragMessageIds={selectedIds.includes(message.id) ? selectedIds : [message.id]}
					/>
				))}
				{isLoading && <SkeletonRows count={7} compact={compact} />}
				{!isLoading && messages.length === 0 && (
					<p className="px-6 py-4 text-sm text-neutral-500">
						{hasActiveFilters ? "No messages match these filters" : config.emptyText}
					</p>
				)}
			</div>
		</div>
	);
}
