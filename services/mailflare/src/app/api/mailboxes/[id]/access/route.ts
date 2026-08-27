import { NextResponse } from "next/server";

const mailboxAccessRemovedResponse = () =>
	NextResponse.json({ error: "Delegated mailbox access is not available in this build" }, { status: 410 });

export async function GET() {
	return mailboxAccessRemovedResponse();
}

export async function POST() {
	return mailboxAccessRemovedResponse();
}

export async function DELETE() {
	return mailboxAccessRemovedResponse();
}
