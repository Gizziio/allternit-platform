import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/runtime/context/project/instance"
import { Session } from "../../src/runtime/session"
import { BackgroundTask } from "../../src/runtime/session/background-task"
import { Identifier } from "../../src/shared/id/id"
import { tmpdir } from "../fixture/fixture"

describe("durable background task lifecycle", () => {
  test("persists ownership, output, and terminal-state idempotence", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const parent = await Session.create({})
        const child = await Session.create({ parentID: parent.id, agentID: "explore" })
        const id = Identifier.ascending("task")

        const created = await BackgroundTask.create({
          id,
          parentSessionID: parent.id,
          childSessionID: child.id,
          kind: "subagent",
          description: "inspect files",
        })
        expect(created).toMatchObject({ id, parentSessionID: parent.id, status: "running" })
        expect(await BackgroundTask.countActive(parent.id)).toBe(1)

        const completed = await BackgroundTask.complete(id, "finished")
        expect(completed).toMatchObject({ status: "completed", output: "finished" })
        expect(await BackgroundTask.countActive(parent.id)).toBe(0)

        // A late rejection from an already-cancelled/completed worker cannot
        // overwrite the first terminal result.
        expect(await BackgroundTask.fail(id, new Error("late failure"))).toMatchObject({
          status: "completed",
          output: "finished",
        })

        await Session.remove(parent.id)
      },
    })
  })

  test("keeps print policy scoped to the parent session", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const first = await Session.create({})
        const second = await Session.create({})
        BackgroundTask.setPrintPolicy(first.id, "drain")
        expect(BackgroundTask.getPrintPolicy(first.id)).toBe("drain")
        expect(BackgroundTask.getPrintPolicy(second.id)).toBe("steer")
        await Session.remove(first.id)
        await Session.remove(second.id)
      },
    })
  })

  test("wait resolves from the terminal lifecycle event", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const parent = await Session.create({})
        const id = Identifier.ascending("task")
        await BackgroundTask.create({
          id,
          parentSessionID: parent.id,
          kind: "test",
          description: "event wait",
        })
        const waiting = BackgroundTask.wait(id, 1_000)
        await BackgroundTask.complete(id, "event output")
        await expect(waiting).resolves.toMatchObject({ status: "completed", output: "event output" })
        await Session.remove(parent.id)
      },
    })
  })
})
