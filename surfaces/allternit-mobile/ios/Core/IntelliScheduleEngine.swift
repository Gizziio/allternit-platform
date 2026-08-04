import Foundation

// -----------------------------------------------------------------------------
// iOS port of the Intelli-Schedule optimizer.
//
// Source: cmd/gizzi-code/src/scheduler/IntelliScheduleEngine.ts
// Same algorithm: sort tasks by (-blockingCount, deadline, -priority,
// estimatedMinutes, id), then allocate contiguous working time across days
// respecting availableHoursPerDay and dependency buffers.
// -----------------------------------------------------------------------------

/// One schedulable task.
struct IntelliTask: Identifiable, Sendable {
    let id: String
    let title: String
    let priority: Int
    let estimatedMinutes: Int
    let deadline: Date?
    let dependencies: [String]
}

/// A scheduled entry returned by the engine.
struct IntelliScheduleEntry: Sendable {
    let taskId: String
    let startTime: Date
    let endTime: Date
    let risk: IntelliScheduleRisk
}

enum IntelliScheduleRisk: String, Sendable {
    case low
    case medium
    case high
}

/// Constraints passed to the optimizer.
struct IntelliScheduleConstraints: Sendable {
    var availableHoursPerDay: Double = 8
    var startTime: Date = Date()
    var bufferMinutes: Double = 15
}

/// Output of the optimizer.
struct IntelliScheduleOutput: Sendable {
    let orderedTasks: [String]
    let schedule: [IntelliScheduleEntry]
    let unrunnable: [String]
}

/// iOS Intelli-Schedule engine.
final class IntelliScheduleEngine: Sendable {
    func optimize(tasks: [IntelliTask], constraints: IntelliScheduleConstraints) -> IntelliScheduleOutput {
        let hoursPerDay = constraints.availableHoursPerDay
        let bufferMs = constraints.bufferMinutes * 60 * 1_000
        let startRef = constraints.startTime

        var orderedTasks: [String] = []
        var schedule: [IntelliScheduleEntry] = []
        var unrunnable: [String] = []

        guard hoursPerDay > 0 else {
            return IntelliScheduleOutput(orderedTasks: [], schedule: [], unrunnable: tasks.map(\.id))
        }

        // Blocking count: how many tasks depend on each task.
        var blockingCount: [String: Int] = [:]
        for task in tasks {
            blockingCount[task.id] = 0
        }
        for task in tasks {
            for depId in task.dependencies {
                if blockingCount[depId] != nil {
                    blockingCount[depId, default: 0] += 1
                }
            }
        }

        // Sort: more blockers first, then earlier deadline, then higher priority,
        // then shorter estimate, then stable id.
        let sorted = tasks.sorted { a, b in
            let bcA = blockingCount[a.id] ?? 0
            let bcB = blockingCount[b.id] ?? 0
            if bcA != bcB { return bcA > bcB }

            let dlA = a.deadline?.timeIntervalSince1970 ?? Double.infinity
            let dlB = b.deadline?.timeIntervalSince1970 ?? Double.infinity
            if dlA != dlB { return dlA < dlB }

            if a.priority != b.priority { return a.priority > b.priority }
            if a.estimatedMinutes != b.estimatedMinutes {
                return a.estimatedMinutes < b.estimatedMinutes
            }
            return a.id.localizedStandardCompare(b.id) == .orderedAscending
        }

        var scheduledMap: [String: IntelliScheduleEntry] = [:]
        var dayAllocations: [String: Double] = [:]

        for task in sorted {
            guard let result = allocateTask(
                task: task,
                startRef: startRef,
                hoursPerDay: hoursPerDay,
                bufferMs: bufferMs,
                dayAllocations: &dayAllocations,
                scheduledMap: scheduledMap
            ) else {
                unrunnable.append(task.id)
                continue
            }

            let entry = IntelliScheduleEntry(
                taskId: task.id,
                startTime: result.startTime,
                endTime: result.endTime,
                risk: calculateRisk(endTime: result.endTime, deadline: task.deadline)
            )
            scheduledMap[task.id] = entry
            orderedTasks.append(task.id)
            schedule.append(entry)
        }

        return IntelliScheduleOutput(orderedTasks: orderedTasks, schedule: schedule, unrunnable: unrunnable)
    }

    // MARK: - Allocation

    private func allocateTask(
        task: IntelliTask,
        startRef: Date,
        hoursPerDay: Double,
        bufferMs: Double,
        dayAllocations: inout [String: Double],
        scheduledMap: [String: IntelliScheduleEntry]
    ) -> (startTime: Date, endTime: Date)? {
        let durationMs = Double(task.estimatedMinutes) * 60 * 1_000
        let deadlineMs = task.deadline?.timeIntervalSince1970

        // Earliest start respecting dependencies.
        var earliestStart = startRef.timeIntervalSince1970
        for depId in task.dependencies {
            if let dep = scheduledMap[depId] {
                earliestStart = max(earliestStart, dep.endTime.timeIntervalSince1970 + bufferMs / 1_000)
            }
        }

        var remainingMs = durationMs
        var taskAllocations: [String: Double] = [:]
        var taskStartTime: Double?
        var currentStart = earliestStart
        let maxDays = 3650
        var daysChecked = 0

        func dayKey(_ ts: Double) -> String {
            let date = Date(timeIntervalSince1970: ts)
            var cal = Calendar.current
            cal.timeZone = TimeZone.current
            let comps = cal.dateComponents([.year, .month, .day], from: date)
            return "\(comps.year ?? 0)-\(comps.month ?? 0)-\(comps.day ?? 0)"
        }

        func undo() {
            for (day, mins) in taskAllocations {
                dayAllocations[day, default: 0] -= mins
            }
        }

        while remainingMs > 0.0001 {
            if let deadlineMs, currentStart >= deadlineMs {
                undo()
                return nil
            }
            if daysChecked > maxDays {
                undo()
                return nil
            }

            let day = dayKey(currentStart)
            let usedMs = (dayAllocations[day] ?? 0) * 60 * 1_000
            let dayCapacityMs = hoursPerDay * 60 * 60 * 1_000
            let availableMs = max(0, dayCapacityMs - usedMs)

            if taskStartTime == nil {
                taskStartTime = currentStart
            }

            if availableMs <= 0 {
                // Move to next day at start reference hour.
                let currentDate = Date(timeIntervalSince1970: currentStart)
                var cal = Calendar.current
                cal.timeZone = TimeZone.current
                var comps = cal.dateComponents([.year, .month, .day], from: currentDate)
                comps.day = (comps.day ?? 0) + 1
                comps.hour = cal.component(.hour, from: startRef)
                comps.minute = cal.component(.minute, from: startRef)
                comps.second = cal.component(.second, from: startRef)
                if let next = cal.date(from: comps) {
                    currentStart = next.timeIntervalSince1970
                } else {
                    currentStart += 24 * 60 * 60
                }
                daysChecked += 1
                continue
            }

            let takeMs = min(remainingMs, availableMs)
            let takeMinutes = takeMs / (60 * 1_000)
            taskAllocations[day, default: 0] += takeMinutes
            dayAllocations[day, default: 0] += takeMinutes
            remainingMs -= takeMs
            currentStart += takeMs / 1_000
            daysChecked += 1
        }

        guard let start = taskStartTime else { return nil }
        return (
            startTime: Date(timeIntervalSince1970: start),
            endTime: Date(timeIntervalSince1970: currentStart)
        )
    }

    // MARK: - Risk

    private func calculateRisk(endTime: Date, deadline: Date?) -> IntelliScheduleRisk {
        guard let deadline else { return .low }
        let remaining = deadline.timeIntervalSince1970 - endTime.timeIntervalSince1970
        if remaining < 0 { return .high }
        if remaining < 24 * 60 * 60 { return .medium }
        return .low
    }
}
