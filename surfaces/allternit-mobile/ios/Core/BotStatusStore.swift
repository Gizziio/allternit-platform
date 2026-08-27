import Foundation

/// Per-bot operational status + activity projection.
///
/// iOS counterpart of the web's `useBotOperationalStateStore`
/// (surfaces/ai.allternit.com/src/lib/bots/bot-operational-state.store.ts).
///
/// On subscribe the store first bootstraps from the server-owned event
/// ledger (BotEventsClient → `GET /api/v1/bots/:id/operational-state` +
/// `GET /api/v1/bots/:id/events`, cmd/allternit-api/src/bot_event_routes.rs):
/// the server projection wins over any client-folded state and its event
/// page seeds the activity feed. The agent events SSE stream
/// (AgentEventsClient → `GET /api/v1/agents/:id/events`,
/// cmd/allternit-api/src/agent_routes.rs:84-138) then stays the live
/// transport, folded into the projection as below and appended to the feed.
///
/// ## Event → status mapping
///
/// The stream carries the run-lifecycle events from agent_routes.rs plus the
/// four runtime-bridged wait-state events from
/// `POST /api/v1/agents/:id/events/ingest` (fed by gizzi-code's
/// agent-event-bridge from the permission/question/session bus). The fold is
/// deliberately conservative — where the stream gives no signal, the last
/// state is kept (never invented):
///
///   agent.run.started            → working    (run id tracked as active)
///   agent.run.completed          → completed  (once no runs remain active)
///   agent.run.failed             → failed     (once no runs remain active)
///   agent.run.waiting_approval   → waiting_approval (+1 pendingApprovalsCount)
///   agent.run.approval_resolved  → working    (-1 pendingApprovalsCount, floored
///                                  at 0; back to working once no approvals
///                                  remain, idle if no run is active either)
///   agent.run.waiting_input      → waiting_input
///   agent.run.blocked            → blocked
///   agent.created                → no status change (activity feed entry only)
///   unknown types                → no status change (activity feed entry only)
///
/// A finished run does NOT downgrade the status while another run is still
/// active — concurrent runs interleave in the ledger, and `working` (the
/// still-active signal) outranks `completed` in the web precedence table
/// (bot-operational-state.store.ts:52-63: waiting_approval > blocked >
/// failed > working > waiting_input > degraded > completed > idle > offline).
///
/// Status semantics table: bot-operational-state.store.ts:15-31.
@MainActor
final class BotStatusStore: ObservableObject {
    static let shared = BotStatusStore()

    /// One bot's projected status plus its recent activity tail.
    struct Entry: Sendable {
        var state: BotOperationalState
        var subscriptionState: SubscriptionState
        /// Newest last, capped at 100 (the feed reverses for display).
        var recentEvents: [FeedItem]
        var lastFetchedAt: Date
        /// Last bootstrap failure (server ledger fetch), cleared on the next
        /// successful bootstrap — the repo's `loadError` convention: the
        /// store keeps whatever it last had and views can render the error.
        var loadError: String?
    }

    /// One row of the Activity feed: a live SSE run event
    /// (`AgentRunEvent`, agent_routes.rs ledger) or a server-ledger bot
    /// event (`BotEvent`, bot_event_routes.rs) seeded from history.
    enum FeedItem: Sendable {
        case run(AgentRunEvent)
        case bot(BotEvent)

        /// Stable identity for dedupe. Server rows carry a real id; SSE
        /// frames don't, so theirs is synthesized from type + timestamp +
        /// run scope (never used to dedupe, only to key the list).
        var id: String {
            switch self {
            case .run(let event):
                return "sse:\(event.label):\(event.timestamp?.timeIntervalSince1970 ?? 0):\(event.envelope.runId ?? "")"
            case .bot(let event):
                return event.id
            }
        }

        var label: String {
            switch self {
            case .run(let event): return event.label
            case .bot(let event): return event.label
            }
        }

        var timestamp: Date? {
            switch self {
            case .run(let event): return event.timestamp
            case .bot(let event): return event.occurredAtDate
            }
        }
    }

    /// Stream health, mirroring the web `SubscriptionState`
    /// (bot-operational-state.store.ts:85).
    enum SubscriptionState: String, Sendable {
        case connected, reconnecting, stale, offline
    }

    /// A bot explicitly pinned by the user for the Dynamic Island Live
    /// Activity. The display name is cached here so the widget doesn't need
    /// access to `AgentHubStore`.
    struct PinnedBot: Sendable {
        let botId: String
        let displayName: String
    }

    @Published private(set) var entries: [String: Entry] = [:]
    @Published private(set) var pinnedBot: PinnedBot? = nil

    private let client: AgentEventsClient
    private let botEventsClient: BotEventsClient
    private var subscriptionTasks: [String: Task<Void, Never>] = [:]
    /// Run ids with a `run.started` but no terminal event yet, per bot —
    /// the guard against a finished run downgrading a bot that is still
    /// working on another run.
    private var activeRunIds: [String: Set<String>] = [:]
    /// Server-ledger event ids already seeded into the feed, per bot — the
    /// dedupe guard when a re-subscribe re-fetches overlapping history.
    private var seededBotEventIds: [String: Set<String>] = [:]
    /// Agent SSE replays its recent tail on every reconnect. Track stable
    /// synthesized identities so replayed frames do not double-apply approval
    /// counts or duplicate activity rows.
    private var seenAgentEventIds: [String: Set<String>] = [:]

    private static let maxRecentEvents = 100
    /// Server history page seeded into the feed on subscribe (the server's
    /// default page size, bot_event_routes.rs `DEFAULT_PAGE_LIMIT`).
    private static let historyPageLimit = 50
    /// Pause between reconnect attempts when the stream drops (the server
    /// polls its ledger every 2s; 5s keeps us well under its pace).
    private static let reconnectDelay: Duration = .seconds(5)

    init(client: AgentEventsClient = .shared, botEventsClient: BotEventsClient = .shared) {
        self.client = client
        self.botEventsClient = botEventsClient
    }

    // MARK: - Selectors (web parity)

    func entry(for botId: String) -> Entry? {
        entries[botId]
    }

    /// Web `getStatus` — unsubscribed bots read as their neutral `idle`
    /// seed, not `offline` (see BotOperationalState's init doc).
    func status(for botId: String) -> BotOperationalStatus {
        entries[botId]?.state.status ?? .idle
    }

    func isWorking(for botId: String) -> Bool {
        status(for: botId).isWorking
    }

    func needsAttention(for botId: String) -> Bool {
        status(for: botId).needsAttention
    }

    // MARK: - Subscription lifecycle

    /// Starts (idempotently) the SSE fold for one bot. Re-subscribing an
    /// already-subscribed bot is a no-op — hub cards re-appear on scroll.
    func subscribe(botId: String) {
        guard subscriptionTasks[botId] == nil else { return }

        if var entry = entries[botId] {
            entry.subscriptionState = .reconnecting
            entries[botId] = entry
        } else {
            entries[botId] = Entry(
                state: BotOperationalState(),
                subscriptionState: .reconnecting,
                recentEvents: [],
                lastFetchedAt: Date(),
                loadError: nil
            )
        }

        subscriptionTasks[botId] = Task { [weak self] in
            guard let self else { return }
            // Seed from the server-owned ledger BEFORE opening the stream:
            // the server projection wins over any stale folded state and
            // its history page fills the feed; SSE then appends live.
            await self.bootstrap(botId: botId)
            // Reconnect loop: the server never ends the stream on its own, so
            // a finished/errored stream means the connection dropped — mark
            // stale and re-open after a short delay, until unsubscribed.
            while !Task.isCancelled {
                do {
                    for try await event in self.client.eventStream(agentId: botId) {
                        self.apply(event, to: botId)
                    }
                } catch is CancellationError {
                    // View went away mid-flight — keep current state.
                    return
                } catch {
                    guard !Task.isCancelled else { return }
                }
                guard !Task.isCancelled else { return }
                self.setSubscriptionState(.stale, for: botId)
                try? await Task.sleep(for: Self.reconnectDelay)
            }
        }
    }

    /// Stops the stream for one bot. The last known status and activity tail
    /// are kept so a re-appearing view repaints instantly; only the
    /// subscription health flips to `offline` (web `markOffline` posture,
    /// minus the status overwrite — unsubscribing is a UI event, not a
    /// daemon-reachability signal).
    func unsubscribe(botId: String) {
        subscriptionTasks.removeValue(forKey: botId)?.cancel()
        setSubscriptionState(.offline, for: botId)
    }

    // MARK: - Live Activity pin

    /// Pin a bot to the Dynamic Island Live Activity. While pinned and active,
    /// the activity shows this bot's status; when the pinned bot is idle/offline
    /// the activity falls back to the summary view or dismisses.
    func pin(botId: String, displayName: String) {
        pinnedBot = PinnedBot(botId: botId, displayName: displayName)
        syncLiveActivity()
    }

    /// Remove the pinned bot and return to summary mode.
    func unpin() {
        pinnedBot = nil
        syncLiveActivity()
    }

    func isPinned(botId: String) -> Bool {
        pinnedBot?.botId == botId
    }

    // MARK: - Server bootstrap

    /// Fetches the server-owned operational state and the latest events
    /// page, then merges both into the entry. A failure leaves the SSE-only
    /// behavior in place and surfaces `loadError` on the entry (the repo's
    /// store convention — never silently swallowed).
    private func bootstrap(botId: String) async {
        do {
            let serverState = try await botEventsClient.fetchOperationalState(botId: botId)
            // The events endpoint is ascending. Resume just before the server
            // projection's head so the feed receives the newest page rather
            // than the oldest page in a long-lived bot's history.
            let afterSequence = max(0, serverState.lastEventSequence - Self.historyPageLimit)
            let serverPage = try await botEventsClient.fetchEvents(
                botId: botId,
                afterSequence: afterSequence,
                limit: Self.historyPageLimit
            )
            guard !Task.isCancelled else { return }
            mergeBootstrap(state: serverState, page: serverPage, for: botId)
        } catch is CancellationError {
            // View went away mid-flight — keep current state.
        } catch {
            guard !Task.isCancelled else { return }
            setLoadError(error.localizedDescription, for: botId)
        }
    }

    /// Applies the bootstrap payload: the server projection replaces the
    /// client-folded state (the server is the source of truth — only
    /// `subscriptionState` stays local), and the history page seeds the
    /// feed. Rows come ascending by `sequence`; appending them in order
    /// keeps the feed newest-last so live SSE events land after them.
    /// Re-subscribes can re-fetch overlapping history, so rows are deduped
    /// by server id.
    private func mergeBootstrap(state: BotOperationalState, page: BotEventPage, for botId: String) {
        guard var entry = entries[botId] else { return }
        entry.state = state
        entry.lastFetchedAt = Date()
        entry.loadError = nil

        var seeded = seededBotEventIds[botId] ?? []
        for event in page.events {
            guard seeded.insert(event.id).inserted else { continue }
            entry.recentEvents.append(.bot(event))
        }
        if entry.recentEvents.count > Self.maxRecentEvents {
            entry.recentEvents.removeFirst(entry.recentEvents.count - Self.maxRecentEvents)
        }
        seededBotEventIds[botId] = seeded
        entries[botId] = entry
        syncLiveActivity()
    }

    private func setLoadError(_ message: String, for botId: String) {
        guard var entry = entries[botId] else { return }
        entry.loadError = message
        entries[botId] = entry
    }

    // MARK: - Event fold

    /// Folds one stream event into the bot's projection + activity tail.
    private func apply(_ event: AgentRunEvent, to botId: String) {
        let feedItem = FeedItem.run(event)
        var seen = seenAgentEventIds[botId] ?? []
        guard seen.insert(feedItem.id).inserted else { return }
        seenAgentEventIds[botId] = seen

        var entry = entries[botId] ?? Entry(
            state: BotOperationalState(),
            subscriptionState: .connected,
            recentEvents: [],
            lastFetchedAt: Date(),
            loadError: nil
        )

        entry.subscriptionState = .connected
        entry.lastFetchedAt = Date()
        entry.recentEvents.append(feedItem)
        if entry.recentEvents.count > Self.maxRecentEvents {
            entry.recentEvents.removeFirst(entry.recentEvents.count - Self.maxRecentEvents)
        }

        var activeRuns = activeRunIds[botId] ?? []
        switch event {
        case .runStarted(let started):
            if let runId = started.envelope.runId {
                activeRuns.insert(runId)
            }
            entry.state.status = .working
            entry.state.activeRunId = started.envelope.runId
            entry.state.activityLabel = "Running"
        case .runCompleted(let completed):
            if let runId = completed.envelope.runId {
                activeRuns.remove(runId)
            }
            if activeRuns.isEmpty {
                entry.state.status = .completed
                entry.state.activeRunId = nil
                entry.state.activityLabel = nil
            }
        case .runFailed(let failed):
            if let runId = failed.envelope.runId {
                activeRuns.remove(runId)
            }
            if activeRuns.isEmpty {
                entry.state.status = .failed
                entry.state.activeRunId = nil
                entry.state.activityLabel = nil
            }
        case .waitingApproval(let waiting):
            // A runtime permission prompt pauses the run without ending it —
            // the run stays in activeRuns, only the status/count move.
            entry.state.pendingApprovalsCount += 1
            entry.state.status = .waitingApproval
            if let runId = waiting.envelope.runId {
                entry.state.activeRunId = runId
            }
            entry.state.activityLabel = "Waiting for approval"
        case .approvalResolved:
            // Floored at zero like the server-side fold (bot_event_routes.rs):
            // bridged question resolutions reuse this event type and don't
            // have a matching waiting_approval increment.
            entry.state.pendingApprovalsCount = max(0, entry.state.pendingApprovalsCount - 1)
            if entry.state.pendingApprovalsCount == 0 {
                if activeRuns.isEmpty {
                    entry.state.status = .idle
                    entry.state.activeRunId = nil
                    entry.state.activityLabel = nil
                } else {
                    entry.state.status = .working
                    entry.state.activityLabel = "Running"
                }
            }
        case .waitingInput(let waiting):
            entry.state.status = .waitingInput
            if let runId = waiting.envelope.runId {
                entry.state.activeRunId = runId
            }
            entry.state.activityLabel = "Needs input"
        case .blocked(let blocked):
            entry.state.status = .blocked
            if let runId = blocked.envelope.runId {
                entry.state.activeRunId = runId
            }
            entry.state.activityLabel = "Blocked"
        case .agentCreated, .unknown:
            // No status signal on these events — activity feed entry only.
            break
        }
        activeRunIds[botId] = activeRuns

        entry.state.updatedAt = ISO8601DateFormatter().string(from: entry.lastFetchedAt)
        entries[botId] = entry
        syncLiveActivity()
    }

    private func setSubscriptionState(_ state: SubscriptionState, for botId: String) {
        guard var entry = entries[botId] else { return }
        entry.subscriptionState = state
        entries[botId] = entry
    }

    private func syncLiveActivity() {
        BotLiveActivityManager.shared.sync(with: entries, pinnedBot: pinnedBot)
    }
}
