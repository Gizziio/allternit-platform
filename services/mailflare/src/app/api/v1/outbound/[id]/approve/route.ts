import { NextResponse } from "next/server";
import { approveOutboundJob } from "@/lib/email/send";
import { authorizeJobReview, type OutboundRouteParams } from "../review-utils";

export async function POST(request: Request, { params }: OutboundRouteParams) {
	const result = await authorizeJobReview(request, params);
	if (!result.ok) return result.response;

	await approveOutboundJob(result.env, result.review);
	return NextResponse.json({
		jobId: result.review.job.id,
		messageId: result.review.message.id,
		status: "queued",
	});
}
