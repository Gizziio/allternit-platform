import type { ProviderActionDefinition } from "../../core/provider-definition.ts";
import type { JsonSchema } from "../../core/types.ts";

import { s } from "../../core/json-schema.ts";
import { defineProviderAction } from "../../core/provider-definition.ts";

const service = "tikhub" as const;
const tikhubUserScope = "/api/v1/tikhub/user/" as const;
const tikhubTiktokWebScope = "/api/v1/tiktok/web/" as const;
const tikhubDouyinWebScope = "/api/v1/douyin/web/" as const;
const tikhubXiaohongshuAppV2Scope = "/api/v1/xiaohongshu/app_v2/" as const;
const tikhubXiaohongshuWebV2Scope = "/api/v1/xiaohongshu/web_v2/" as const;
const tikhubDouyinSearchScope = "/api/v1/douyin/search/" as const;
const tikhubDouyinBillboardScope = "/api/v1/douyin/billboard/" as const;

function defineTikHubUserAction<TName extends string>(input: {
  name: TName;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
}) {
  return defineProviderAction(service, {
    requiredScopes: [tikhubUserScope],
    providerPermissions: [tikhubUserScope],
    ...input,
  });
}

function defineTikHubScopedAction<TName extends string>(input: {
  name: TName;
  description: string;
  scope: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
}) {
  const { scope, ...action } = input;
  return defineProviderAction(service, {
    requiredScopes: [scope],
    providerPermissions: [scope],
    ...action,
  });
}

const endpointSchema = s.string("The TikHub endpoint path to inspect or price.", {
  minLength: 1,
  pattern: "^/",
});
const nonEmptyStringSchema = (description: string) => s.string(description, { minLength: 1 });
const optionalStringSchema = (description: string) => s.string(description);
const optionalIntegerSchema = (description: string) => s.integer(description);
const optionalBooleanSchema = (description: string) => s.boolean(description);

const envelopeSchema = s.object(
  "The normalized TikHub response envelope.",
  {
    code: s.nullable(s.integer("The status-like code returned in the TikHub response body.")),
    requestId: s.nullable(s.string("The TikHub request identifier when returned.")),
    message: s.nullable(s.string("The TikHub response message when returned.")),
    router: s.nullable(s.string("The TikHub router path reported by the response.")),
    params: s.nullable(s.looseObject("The request parameters echoed by TikHub when returned.")),
  },
  { optional: ["code", "requestId", "message", "router", "params"] },
);

const rawDataSchema = s.unknown("The raw data payload returned by TikHub.");
const rawResponseSchema = s.looseObject("The raw TikHub response payload.");

const apiKeyDataSchema = s.looseObject("TikHub API key metadata returned for the current token.", {
  api_key_name: s.string("The API key name."),
  api_key_scopes: s.array(
    "The TikHub path scopes assigned to the API key.",
    s.string("A TikHub path scope assigned to the API key."),
  ),
  created_at: s.string("The API key creation timestamp."),
  expires_at: s.nullable(s.string("The API key expiration timestamp when configured.")),
  api_key_status: s.integer("The API key status value returned by TikHub."),
});

const userDataSchema = s.looseObject("TikHub account metadata returned for the current token.", {
  email: s.string("The TikHub account email address."),
  balance: s.number("The current account balance."),
  free_credit: s.number("The remaining free credit balance."),
  email_verified: s.boolean("Whether the TikHub account email is verified."),
  account_disabled: s.boolean("Whether the TikHub account is disabled."),
  is_active: s.boolean("Whether the TikHub account is active."),
});

const usageEntrySchema = s.looseObject("One TikHub daily usage entry.");
const socialOutputSchema = (
  description: string,
  key: "profile" | "post" | "posts" | "comments" | "replies" | "results" | "hotList",
) =>
  s.object(description, {
    envelope: envelopeSchema,
    [key]: rawDataSchema,
    rawData: rawDataSchema,
    raw: rawResponseSchema,
  });

const pagedPostsOutputSchema = (description: string, key: "posts" | "comments" | "replies") =>
  s.object(description, {
    envelope: envelopeSchema,
    [key]: rawDataSchema,
    rawData: rawDataSchema,
    raw: rawResponseSchema,
  });

const tiktokProfileInputSchema = s.object(
  "The input payload for fetching a TikTok user profile. Provide either uniqueId or secUid.",
  {
    uniqueId: optionalStringSchema("The TikTok user uniqueId."),
    secUid: optionalStringSchema("The TikTok user secUid."),
  },
  { optional: ["uniqueId", "secUid"] },
);

const tiktokPostListInputSchema = s.object(
  "The input payload for fetching TikTok user posts.",
  {
    secUid: nonEmptyStringSchema("The TikTok user secUid."),
    cursor: optionalIntegerSchema("The page cursor."),
    count: optionalIntegerSchema("The number of posts to return."),
    coverFormat: optionalIntegerSchema("The TikTok cover format value."),
    postItemListRequestType: optionalIntegerSchema("The TikTok post list sort type."),
  },
  { optional: ["cursor", "count", "coverFormat", "postItemListRequestType"] },
);

const tiktokCommentInputSchema = s.object(
  "The input payload for fetching TikTok post comments.",
  {
    awemeId: nonEmptyStringSchema("The TikTok post aweme ID."),
    cursor: optionalIntegerSchema("The page cursor."),
    count: optionalIntegerSchema("The number of comments to return."),
    currentRegion: optionalStringSchema("The current region code used by TikHub."),
  },
  { optional: ["cursor", "count", "currentRegion"] },
);

const tiktokSearchUserInputSchema = s.object(
  "The input payload for searching TikTok users.",
  {
    keyword: nonEmptyStringSchema("The TikTok search keyword."),
    cursor: optionalIntegerSchema("The page cursor."),
    searchId: optionalStringSchema("The TikTok search ID from a previous response."),
  },
  { optional: ["cursor", "searchId"] },
);

const douyinVideoDetailInputSchema = s.object(
  "The input payload for fetching a Douyin video.",
  {
    awemeId: nonEmptyStringSchema("The Douyin video aweme ID."),
    needAnchorInfo: optionalBooleanSchema("Whether TikHub should include anchor information."),
  },
  { optional: ["needAnchorInfo"] },
);

const douyinUserPostsInputSchema = s.object(
  "The input payload for fetching Douyin user posts.",
  {
    secUserId: nonEmptyStringSchema("The Douyin user sec_user_id."),
    maxCursor: optionalStringSchema("The maximum cursor returned by a previous response."),
    count: optionalIntegerSchema("The number of posts to return."),
    filterType: optionalStringSchema("The Douyin filter type."),
  },
  { optional: ["maxCursor", "count", "filterType"] },
);

const douyinCommentInputSchema = s.object(
  "The input payload for fetching Douyin video comments.",
  {
    awemeId: nonEmptyStringSchema("The Douyin video aweme ID."),
    cursor: optionalIntegerSchema("The page cursor."),
    count: optionalIntegerSchema("The number of comments to return."),
  },
  { optional: ["cursor", "count"] },
);

const douyinCommentReplyInputSchema = s.object(
  "The input payload for fetching Douyin comment replies.",
  {
    itemId: nonEmptyStringSchema("The Douyin video item ID."),
    commentId: nonEmptyStringSchema("The Douyin comment ID."),
    cursor: optionalIntegerSchema("The page cursor."),
    count: optionalIntegerSchema("The number of replies to return."),
  },
  { optional: ["cursor", "count"] },
);

const xiaohongshuNoteSearchInputSchema = s.object(
  "The input payload for searching Xiaohongshu notes.",
  {
    keywords: nonEmptyStringSchema("The Xiaohongshu search keywords."),
    page: optionalIntegerSchema("The result page number."),
    sortType: optionalStringSchema("The Xiaohongshu note sort type."),
    noteType: optionalStringSchema(
      'The Xiaohongshu note type filter. Supported string values include "0", "1", "2", "all", "image", and "video".',
    ),
  },
  { optional: ["page", "sortType", "noteType"] },
);

const xiaohongshuUserSearchInputSchema = s.object(
  "The input payload for searching Xiaohongshu users.",
  {
    keywords: nonEmptyStringSchema("The Xiaohongshu search keywords."),
    page: optionalIntegerSchema("The result page number."),
  },
  { optional: ["page"] },
);

const xiaohongshuNoteCommentsInputSchema = s.object(
  "The input payload for fetching Xiaohongshu note comments. Provide either noteId or shareText.",
  {
    noteId: optionalStringSchema("The Xiaohongshu note ID."),
    shareText: optionalStringSchema("The Xiaohongshu note share link."),
    cursor: optionalStringSchema("The comment cursor."),
    index: optionalIntegerSchema("The comment index returned by a previous response."),
    pageArea: optionalStringSchema("The comment fold state, such as UNFOLDED or FOLDED."),
    sortStrategy: optionalStringSchema("The comment sort strategy, such as default, latest_v2, or like_count."),
  },
  { optional: ["noteId", "shareText", "cursor", "index", "pageArea", "sortStrategy"] },
);

const xiaohongshuSubCommentsInputSchema = s.object(
  "The input payload for fetching Xiaohongshu sub-comments. Provide either noteId or shareText.",
  {
    noteId: optionalStringSchema("The Xiaohongshu note ID."),
    shareText: optionalStringSchema("The Xiaohongshu note share link."),
    commentId: nonEmptyStringSchema("The Xiaohongshu parent comment ID."),
    cursor: optionalStringSchema("The sub-comment cursor."),
    lastCursor: optionalStringSchema("Deprecated compatibility alias for cursor. Prefer cursor for new calls."),
    index: optionalIntegerSchema("The sub-comment pagination index."),
  },
  { optional: ["noteId", "shareText", "cursor", "lastCursor", "index"] },
);

const xiaohongshuUserLookupInputSchema = s.object(
  "The input payload for fetching Xiaohongshu user information. Provide either userId or shareText.",
  {
    userId: optionalStringSchema("The Xiaohongshu user ID."),
    shareText: optionalStringSchema("The Xiaohongshu profile share link."),
  },
  { optional: ["userId", "shareText"] },
);

const xiaohongshuUserNotesInputSchema = s.object(
  "The input payload for fetching Xiaohongshu user notes. Provide either userId or shareText.",
  {
    userId: optionalStringSchema("The Xiaohongshu user ID."),
    shareText: optionalStringSchema("The Xiaohongshu profile share link."),
    cursor: optionalStringSchema("The pagination cursor returned by a previous response."),
    lastCursor: optionalStringSchema("Deprecated compatibility alias for cursor. Prefer cursor for new calls."),
  },
  { optional: ["userId", "shareText", "cursor", "lastCursor"] },
);

const douyinVideoSearchInputSchema = s.object(
  "The input payload for searching Douyin videos.",
  {
    keyword: nonEmptyStringSchema("The Douyin search keyword."),
    cursor: optionalIntegerSchema("The offset cursor returned by a previous response."),
    sortType: optionalStringSchema("The Douyin sort type, such as 0, 1, or 2."),
    publishTime: optionalStringSchema("The Douyin publish time filter."),
    filterDuration: optionalStringSchema("The Douyin video duration filter."),
    contentType: optionalStringSchema("The Douyin content type filter."),
    searchId: optionalStringSchema("The Douyin search ID returned by a previous response."),
    backtrace: optionalStringSchema("The Douyin backtrace token returned by a previous response."),
  },
  {
    optional: ["cursor", "sortType", "publishTime", "filterDuration", "contentType", "searchId", "backtrace"],
  },
);

const douyinUserSearchInputSchema = s.object(
  "The input payload for searching Douyin users.",
  {
    keyword: nonEmptyStringSchema("The Douyin search keyword."),
    cursor: optionalIntegerSchema("The offset cursor returned by a previous response."),
    douyinUserFans: optionalStringSchema("The Douyin fan-count filter."),
    douyinUserType: optionalStringSchema("The Douyin user-type filter."),
    searchId: optionalStringSchema("The Douyin search ID returned by a previous response."),
  },
  { optional: ["cursor", "douyinUserFans", "douyinUserType", "searchId"] },
);

const douyinHotTotalListInputSchema = s.object(
  "The input payload for fetching the Douyin hot total list.",
  {
    page: s.positiveInteger("The result page number."),
    pageSize: s.positiveInteger("The number of hot-list items to return per page."),
    type: nonEmptyStringSchema("The billboard snapshot mode, such as snapshot or range."),
    snapshotTime: optionalStringSchema("The snapshot timestamp formatted as yyyyMMddHHmmss."),
    startDate: optionalStringSchema("The start date formatted as yyyyMMdd."),
    endDate: optionalStringSchema("The end date formatted as yyyyMMdd."),
    sentenceTag: optionalStringSchema("The comma-separated hot-list category tags."),
    keyword: optionalStringSchema("The hot-list keyword filter."),
  },
  {
    optional: ["snapshotTime", "startDate", "endDate", "sentenceTag", "keyword"],
  },
);

const getUserDailyUsageAction = defineTikHubUserAction({
  name: "get_user_daily_usage",
  description: "Get the current TikHub account daily API usage. Requires the /api/v1/tikhub/user/ TikHub path scope.",
  inputSchema: s.object("The input payload for getting TikHub daily usage.", {}),
  outputSchema: s.object("The response returned when getting TikHub daily usage.", {
    envelope: envelopeSchema,
    usage: s.array("The daily usage entries returned by TikHub.", usageEntrySchema),
    rawData: rawDataSchema,
    raw: rawResponseSchema,
  }),
});

const getUserInfoAction = defineTikHubUserAction({
  name: "get_user_info",
  description:
    "Get the current TikHub account and API key information. Requires the /api/v1/tikhub/user/ TikHub path scope.",
  inputSchema: s.object("The input payload for getting TikHub user information.", {}),
  outputSchema: s.object("The response returned when getting TikHub user information.", {
    envelope: envelopeSchema,
    apiKey: s.nullable(apiKeyDataSchema),
    user: s.nullable(userDataSchema),
    scopes: s.array(
      "The TikHub path scopes assigned to the current API key.",
      s.string("A TikHub path scope assigned to the API key."),
    ),
    rawData: rawDataSchema,
    raw: rawResponseSchema,
  }),
});

const getEndpointInfoAction = defineTikHubUserAction({
  name: "get_endpoint_info",
  description: "Get TikHub cost and metadata for one endpoint. Requires the /api/v1/tikhub/user/ TikHub path scope.",
  inputSchema: s.object("The input payload for getting TikHub endpoint information.", {
    endpoint: endpointSchema,
  }),
  outputSchema: s.object("The response returned when getting TikHub endpoint information.", {
    envelope: envelopeSchema,
    endpoint: s.string("The endpoint path that was inspected."),
    endpointInfo: rawDataSchema,
    raw: rawResponseSchema,
  }),
});

const getAllEndpointsInfoAction = defineTikHubUserAction({
  name: "get_all_endpoints_info",
  description: "Get TikHub cost and metadata for all endpoints. Requires the /api/v1/tikhub/user/ TikHub path scope.",
  inputSchema: s.object("The input payload for getting all TikHub endpoint information.", {}),
  outputSchema: s.object("The response returned when getting all TikHub endpoint information.", {
    envelope: envelopeSchema,
    endpoints: rawDataSchema,
    raw: rawResponseSchema,
  }),
});

const calculatePriceAction = defineTikHubUserAction({
  name: "calculate_price",
  description:
    "Calculate TikHub daily request pricing for one endpoint. Requires the /api/v1/tikhub/user/ TikHub path scope.",
  inputSchema: s.object(
    "The input payload for calculating TikHub endpoint pricing.",
    {
      endpoint: endpointSchema,
      requestPerDay: s.positiveInteger("The expected number of daily requests used for the price calculation."),
    },
    { optional: ["requestPerDay"] },
  ),
  outputSchema: s.object("The response returned when calculating TikHub endpoint pricing.", {
    envelope: envelopeSchema,
    endpoint: s.string("The endpoint path used for the calculation."),
    requestPerDay: s.positiveInteger("The daily request count used for the calculation."),
    price: rawDataSchema,
    raw: rawResponseSchema,
  }),
});

const fetchTiktokUserProfileAction = defineTikHubScopedAction({
  name: "fetch_tiktok_user_profile",
  scope: tikhubTiktokWebScope,
  description: "Fetch a public TikTok user profile through TikHub. Requires the /api/v1/tiktok/web/ TikHub path scope.",
  inputSchema: tiktokProfileInputSchema,
  outputSchema: socialOutputSchema("The response returned when fetching a TikTok profile.", "profile"),
});

const fetchTiktokPostDetailAction = defineTikHubScopedAction({
  name: "fetch_tiktok_post_detail",
  scope: tikhubTiktokWebScope,
  description: "Fetch a public TikTok post detail through TikHub. Requires the /api/v1/tiktok/web/ TikHub path scope.",
  inputSchema: s.object("The input payload for fetching a TikTok post detail.", {
    itemId: nonEmptyStringSchema("The TikTok post item ID."),
  }),
  outputSchema: socialOutputSchema("The response returned when fetching a TikTok post.", "post"),
});

const fetchTiktokUserPostsAction = defineTikHubScopedAction({
  name: "fetch_tiktok_user_posts",
  scope: tikhubTiktokWebScope,
  description:
    "Fetch public TikTok posts for a user through TikHub. Requires the /api/v1/tiktok/web/ TikHub path scope.",
  inputSchema: tiktokPostListInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching TikTok user posts.", "posts"),
});

const fetchTiktokPostCommentsAction = defineTikHubScopedAction({
  name: "fetch_tiktok_post_comments",
  scope: tikhubTiktokWebScope,
  description: "Fetch public TikTok post comments through TikHub. Requires the /api/v1/tiktok/web/ TikHub path scope.",
  inputSchema: tiktokCommentInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching TikTok post comments.", "comments"),
});

const searchTiktokUsersAction = defineTikHubScopedAction({
  name: "search_tiktok_users",
  scope: tikhubTiktokWebScope,
  description:
    "Search public TikTok users through TikHub without exposing upstream cookies. Requires the /api/v1/tiktok/web/ TikHub path scope.",
  inputSchema: tiktokSearchUserInputSchema,
  outputSchema: socialOutputSchema("The response returned when searching TikTok users.", "results"),
});

const fetchTiktokTagDetailAction = defineTikHubScopedAction({
  name: "fetch_tiktok_tag_detail",
  scope: tikhubTiktokWebScope,
  description: "Fetch a public TikTok tag detail through TikHub. Requires the /api/v1/tiktok/web/ TikHub path scope.",
  inputSchema: s.object("The input payload for fetching a TikTok tag detail.", {
    tagName: nonEmptyStringSchema("The TikTok tag name."),
  }),
  outputSchema: socialOutputSchema("The response returned when fetching a TikTok tag.", "results"),
});

const fetchTiktokTagPostsAction = defineTikHubScopedAction({
  name: "fetch_tiktok_tag_posts",
  scope: tikhubTiktokWebScope,
  description:
    "Fetch public TikTok posts for a tag through TikHub. Requires the /api/v1/tiktok/web/ TikHub path scope.",
  inputSchema: s.object(
    "The input payload for fetching TikTok tag posts.",
    {
      challengeId: nonEmptyStringSchema("The TikTok challenge ID."),
      count: optionalIntegerSchema("The number of posts to return."),
      cursor: optionalIntegerSchema("The page cursor."),
    },
    { optional: ["count", "cursor"] },
  ),
  outputSchema: pagedPostsOutputSchema("The response returned when fetching TikTok tag posts.", "posts"),
});

const fetchDouyinVideoDetailAction = defineTikHubScopedAction({
  name: "fetch_douyin_video_detail",
  scope: tikhubDouyinWebScope,
  description: "Fetch a public Douyin video detail through TikHub. Requires the /api/v1/douyin/web/ TikHub path scope.",
  inputSchema: douyinVideoDetailInputSchema,
  outputSchema: socialOutputSchema("The response returned when fetching a Douyin video.", "post"),
});

const fetchDouyinVideoByShareUrlAction = defineTikHubScopedAction({
  name: "fetch_douyin_video_by_share_url",
  scope: tikhubDouyinWebScope,
  description:
    "Fetch a public Douyin video detail by share URL through TikHub. Requires the /api/v1/douyin/web/ TikHub path scope.",
  inputSchema: s.object("The input payload for fetching a Douyin video by share URL.", {
    shareUrl: nonEmptyStringSchema("The Douyin video share URL."),
  }),
  outputSchema: socialOutputSchema("The response returned when fetching a Douyin video.", "post"),
});

const fetchDouyinUserProfileByUidAction = defineTikHubScopedAction({
  name: "fetch_douyin_user_profile_by_uid",
  scope: tikhubDouyinWebScope,
  description:
    "Fetch a public Douyin user profile by UID through TikHub. Requires the /api/v1/douyin/web/ TikHub path scope.",
  inputSchema: s.object("The input payload for fetching a Douyin profile by UID.", {
    uid: nonEmptyStringSchema("The Douyin user UID."),
  }),
  outputSchema: socialOutputSchema("The response returned when fetching a Douyin profile.", "profile"),
});

const fetchDouyinUserProfileByShortIdAction = defineTikHubScopedAction({
  name: "fetch_douyin_user_profile_by_short_id",
  scope: tikhubDouyinWebScope,
  description:
    "Fetch a public Douyin user profile by short ID through TikHub. Requires the /api/v1/douyin/web/ TikHub path scope.",
  inputSchema: s.object("The input payload for fetching a Douyin profile by short ID.", {
    shortId: nonEmptyStringSchema("The Douyin user short ID."),
  }),
  outputSchema: socialOutputSchema("The response returned when fetching a Douyin profile.", "profile"),
});

const fetchDouyinUserPostsAction = defineTikHubScopedAction({
  name: "fetch_douyin_user_posts",
  scope: tikhubDouyinWebScope,
  description:
    "Fetch public Douyin posts for a user through TikHub without exposing upstream cookies. Requires the /api/v1/douyin/web/ TikHub path scope.",
  inputSchema: douyinUserPostsInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching Douyin user posts.", "posts"),
});

const fetchDouyinVideoCommentsAction = defineTikHubScopedAction({
  name: "fetch_douyin_video_comments",
  scope: tikhubDouyinWebScope,
  description: "Fetch public Douyin video comments through TikHub. Requires the /api/v1/douyin/web/ TikHub path scope.",
  inputSchema: douyinCommentInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching Douyin video comments.", "comments"),
});

const fetchDouyinVideoCommentRepliesAction = defineTikHubScopedAction({
  name: "fetch_douyin_video_comment_replies",
  scope: tikhubDouyinWebScope,
  description:
    "Fetch public Douyin comment replies through TikHub. Requires the /api/v1/douyin/web/ TikHub path scope.",
  inputSchema: douyinCommentReplyInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching Douyin comment replies.", "replies"),
});

const searchXiaohongshuNotesAction = defineTikHubScopedAction({
  name: "search_xiaohongshu_notes",
  scope: tikhubXiaohongshuAppV2Scope,
  description:
    "Search public Xiaohongshu notes through TikHub. Requires the /api/v1/xiaohongshu/app_v2/ TikHub path scope.",
  inputSchema: xiaohongshuNoteSearchInputSchema,
  outputSchema: socialOutputSchema("The response returned when searching Xiaohongshu notes.", "results"),
});

const searchXiaohongshuUsersAction = defineTikHubScopedAction({
  name: "search_xiaohongshu_users",
  scope: tikhubXiaohongshuAppV2Scope,
  description:
    "Search public Xiaohongshu users through TikHub. Requires the /api/v1/xiaohongshu/app_v2/ TikHub path scope.",
  inputSchema: xiaohongshuUserSearchInputSchema,
  outputSchema: socialOutputSchema("The response returned when searching Xiaohongshu users.", "results"),
});

const fetchXiaohongshuNoteCommentsAction = defineTikHubScopedAction({
  name: "fetch_xiaohongshu_note_comments",
  scope: tikhubXiaohongshuAppV2Scope,
  description:
    "Fetch public Xiaohongshu note comments through TikHub App V2. Requires the /api/v1/xiaohongshu/app_v2/ TikHub path scope.",
  inputSchema: xiaohongshuNoteCommentsInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching Xiaohongshu note comments.", "comments"),
});

const fetchXiaohongshuSubCommentsAction = defineTikHubScopedAction({
  name: "fetch_xiaohongshu_sub_comments",
  scope: tikhubXiaohongshuAppV2Scope,
  description:
    "Fetch public Xiaohongshu sub-comments through TikHub App V2. Requires the /api/v1/xiaohongshu/app_v2/ TikHub path scope.",
  inputSchema: xiaohongshuSubCommentsInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching Xiaohongshu sub-comments.", "replies"),
});

const fetchXiaohongshuUserInfoAction = defineTikHubScopedAction({
  name: "fetch_xiaohongshu_user_info",
  scope: tikhubXiaohongshuAppV2Scope,
  description:
    "Fetch public Xiaohongshu user information through TikHub App V2. Requires the /api/v1/xiaohongshu/app_v2/ TikHub path scope.",
  inputSchema: xiaohongshuUserLookupInputSchema,
  outputSchema: socialOutputSchema("The response returned when fetching Xiaohongshu user information.", "profile"),
});

const fetchXiaohongshuHotListAction = defineTikHubScopedAction({
  name: "fetch_xiaohongshu_hot_list",
  scope: tikhubXiaohongshuWebV2Scope,
  description:
    "Fetch the public Xiaohongshu hot list through TikHub. Requires the /api/v1/xiaohongshu/web_v2/ TikHub path scope.",
  inputSchema: s.object("The input payload for fetching the Xiaohongshu hot list.", {}),
  outputSchema: socialOutputSchema("The response returned when fetching the Xiaohongshu hot list.", "hotList"),
});

const fetchXiaohongshuUserNotesAction = defineTikHubScopedAction({
  name: "fetch_xiaohongshu_user_notes",
  scope: tikhubXiaohongshuAppV2Scope,
  description:
    "Fetch public Xiaohongshu user notes through TikHub App V2. Requires the /api/v1/xiaohongshu/app_v2/ TikHub path scope.",
  inputSchema: xiaohongshuUserNotesInputSchema,
  outputSchema: pagedPostsOutputSchema("The response returned when fetching Xiaohongshu user notes.", "posts"),
});

const fetchXiaohongshuNoteCommentRepliesAction = defineTikHubScopedAction({
  name: "fetch_xiaohongshu_note_comment_replies",
  scope: tikhubXiaohongshuAppV2Scope,
  description:
    "Fetch public Xiaohongshu note comment replies through TikHub App V2. Requires the /api/v1/xiaohongshu/app_v2/ TikHub path scope.",
  inputSchema: xiaohongshuSubCommentsInputSchema,
  outputSchema: pagedPostsOutputSchema(
    "The response returned when fetching Xiaohongshu note comment replies.",
    "replies",
  ),
});

const searchDouyinVideosAction = defineTikHubScopedAction({
  name: "search_douyin_videos",
  scope: tikhubDouyinSearchScope,
  description: "Search public Douyin videos through TikHub. Requires the /api/v1/douyin/search/ TikHub path scope.",
  inputSchema: douyinVideoSearchInputSchema,
  outputSchema: socialOutputSchema("The response returned when searching Douyin videos.", "results"),
});

const searchDouyinUsersAction = defineTikHubScopedAction({
  name: "search_douyin_users",
  scope: tikhubDouyinSearchScope,
  description: "Search public Douyin users through TikHub. Requires the /api/v1/douyin/search/ TikHub path scope.",
  inputSchema: douyinUserSearchInputSchema,
  outputSchema: socialOutputSchema("The response returned when searching Douyin users.", "results"),
});

const fetchDouyinHotTotalListAction = defineTikHubScopedAction({
  name: "fetch_douyin_hot_total_list",
  scope: tikhubDouyinBillboardScope,
  description:
    "Fetch the public Douyin hot total list through TikHub. Requires the /api/v1/douyin/billboard/ TikHub path scope.",
  inputSchema: douyinHotTotalListInputSchema,
  outputSchema: socialOutputSchema("The response returned when fetching the Douyin hot total list.", "hotList"),
});

export const tikhubActions: ProviderActionDefinition[] = [
  getUserDailyUsageAction,
  getUserInfoAction,
  getEndpointInfoAction,
  getAllEndpointsInfoAction,
  calculatePriceAction,
  fetchTiktokUserProfileAction,
  fetchTiktokPostDetailAction,
  fetchTiktokUserPostsAction,
  fetchTiktokPostCommentsAction,
  searchTiktokUsersAction,
  fetchTiktokTagDetailAction,
  fetchTiktokTagPostsAction,
  fetchDouyinVideoDetailAction,
  fetchDouyinVideoByShareUrlAction,
  fetchDouyinUserProfileByUidAction,
  fetchDouyinUserProfileByShortIdAction,
  fetchDouyinUserPostsAction,
  fetchDouyinVideoCommentsAction,
  fetchDouyinVideoCommentRepliesAction,
  searchXiaohongshuNotesAction,
  searchXiaohongshuUsersAction,
  fetchXiaohongshuNoteCommentsAction,
  fetchXiaohongshuSubCommentsAction,
  fetchXiaohongshuUserInfoAction,
  fetchXiaohongshuHotListAction,
  fetchXiaohongshuUserNotesAction,
  fetchXiaohongshuNoteCommentRepliesAction,
  searchDouyinVideosAction,
  searchDouyinUsersAction,
  fetchDouyinHotTotalListAction,
];
