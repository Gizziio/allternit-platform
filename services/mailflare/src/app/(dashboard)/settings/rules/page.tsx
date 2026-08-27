import { InboxRules } from "@/components/settings/inbox-rules";

export default function SettingsRulesPage() {
	return (
		<div className="max-w-3xl space-y-8 p-8">
			<div>
				<h1 className="text-2xl font-semibold text-neutral-900">Rules</h1>
				<p className="mt-1 text-sm text-neutral-500">
					Manage routing and filtering rules for the selected mailbox.
				</p>
			</div>
			<InboxRules />
		</div>
	);
}
