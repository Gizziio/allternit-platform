import XCTest
@testable import Allternit

@MainActor
final class LiveActivityManagerTests: XCTestCase {

    // MARK: - Loop Live Activity projection

    func testLoopContentState_countsIterations() {
        let loop = Loop(
            id: "loop-1",
            agentId: nil,
            command: "echo hello",
            exitCondition: nil,
            maxIterations: 5,
            iterationLog: [
                LoopIteration(iteration: 1, output: "hello", exitCode: 0, timestamp: "2026-08-19T12:00:00Z"),
                LoopIteration(iteration: 2, output: "hello", exitCode: 0, timestamp: "2026-08-19T12:00:01Z"),
            ],
            state: "running",
            timeCreated: 0,
            timeUpdated: 0
        )

        let state = LoopLiveActivityManager.contentState(for: loop)

        XCTAssertEqual(state.iterationsCompleted, 2)
        XCTAssertEqual(state.maxIterations, 5)
        XCTAssertEqual(state.state, "running")
    }

    func testLoopContentState_zeroMaxIterations() {
        let loop = Loop(
            id: "loop-2",
            agentId: nil,
            command: "ping",
            exitCondition: nil,
            maxIterations: 0,
            iterationLog: [],
            state: "running",
            timeCreated: 0,
            timeUpdated: 0
        )

        let state = LoopLiveActivityManager.contentState(for: loop)

        XCTAssertEqual(state.iterationsCompleted, 0)
        XCTAssertEqual(state.maxIterations, 0)
    }

    // MARK: - Bot Live Activity projection

    func testBotProjection_emptyEntries_returnsNil() {
        let state = BotLiveActivityManager.projectedContentState(from: [:])
        XCTAssertNil(state)
    }

    func testBotProjection_onlyIdleBots_returnsNil() {
        let entries: [String: BotStatusStore.Entry] = [
            "bot-1": entry(status: .idle)
        ]
        XCTAssertNil(BotLiveActivityManager.projectedContentState(from: entries))
    }

    func testBotProjection_workingBot_showsWorking() {
        let entries: [String: BotStatusStore.Entry] = [
            "bot-1": entry(status: .working, activityLabel: "Running")
        ]

        guard let state = BotLiveActivityManager.projectedContentState(from: entries) else {
            return XCTFail("Expected a content state")
        }

        XCTAssertEqual(state.status, "working")
        XCTAssertEqual(state.activityLabel, "Running")
        XCTAssertEqual(state.activeBotsCount, 1)
        XCTAssertEqual(state.attentionBotsCount, 0)
        XCTAssertNil(state.displayName)
    }

    func testBotProjection_waitingApprovalDominatesWorking() {
        let entries: [String: BotStatusStore.Entry] = [
            "bot-1": entry(status: .working),
            "bot-2": entry(status: .waitingApproval, pendingApprovalsCount: 3)
        ]

        guard let state = BotLiveActivityManager.projectedContentState(from: entries) else {
            return XCTFail("Expected a content state")
        }

        XCTAssertEqual(state.status, "waiting_approval")
        XCTAssertEqual(state.pendingApprovalsCount, 3)
        XCTAssertEqual(state.activeBotsCount, 2)
        XCTAssertEqual(state.attentionBotsCount, 1)
    }

    func testBotProjection_failedAndBlocked_attentionCountsBoth() {
        let entries: [String: BotStatusStore.Entry] = [
            "bot-1": entry(status: .failed),
            "bot-2": entry(status: .blocked),
            "bot-3": entry(status: .completed)
        ]

        guard let state = BotLiveActivityManager.projectedContentState(from: entries) else {
            return XCTFail("Expected a content state")
        }

        XCTAssertEqual(state.status, "blocked")
        XCTAssertEqual(state.activeBotsCount, 3)
        XCTAssertEqual(state.attentionBotsCount, 2)
    }

    func testBotProjection_offlineBotIgnored() {
        let entries: [String: BotStatusStore.Entry] = [
            "bot-1": entry(status: .offline),
            "bot-2": entry(status: .completed)
        ]

        guard let state = BotLiveActivityManager.projectedContentState(from: entries) else {
            return XCTFail("Expected a content state")
        }

        XCTAssertEqual(state.status, "completed")
        XCTAssertEqual(state.activeBotsCount, 1)
    }

    func testBotProjection_pinnedBotTakesPrecedence() {
        let entries: [String: BotStatusStore.Entry] = [
            "bot-1": entry(status: .working, activityLabel: "Indexing"),
            "bot-2": entry(status: .waitingApproval, pendingApprovalsCount: 1)
        ]
        let pinned = BotStatusStore.PinnedBot(botId: "bot-1", displayName: "Indexer")

        guard let state = BotLiveActivityManager.projectedContentState(from: entries, pinnedBot: pinned) else {
            return XCTFail("Expected a content state")
        }

        XCTAssertEqual(state.status, "working")
        XCTAssertEqual(state.activityLabel, "Indexing")
        XCTAssertEqual(state.displayName, "Indexer")
        XCTAssertEqual(state.activeBotsCount, 1)
        XCTAssertEqual(state.pendingApprovalsCount, 0)
    }

    func testBotProjection_pinnedBotIdleFallsBackToSummary() {
        let entries: [String: BotStatusStore.Entry] = [
            "bot-1": entry(status: .idle),
            "bot-2": entry(status: .working)
        ]
        let pinned = BotStatusStore.PinnedBot(botId: "bot-1", displayName: "IdleBot")

        guard let state = BotLiveActivityManager.projectedContentState(from: entries, pinnedBot: pinned) else {
            return XCTFail("Expected a content state")
        }

        XCTAssertEqual(state.status, "working")
        XCTAssertNil(state.displayName)
    }

    // MARK: - Helpers

    private func entry(
        status: BotOperationalStatus,
        activityLabel: String? = nil,
        pendingApprovalsCount: Int = 0
    ) -> BotStatusStore.Entry {
        var state = BotOperationalState()
        state.status = status
        state.activityLabel = activityLabel
        state.pendingApprovalsCount = pendingApprovalsCount
        return BotStatusStore.Entry(
            state: state,
            subscriptionState: .connected,
            recentEvents: [],
            lastFetchedAt: Date(),
            loadError: nil
        )
    }
}
