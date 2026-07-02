import { expect, test } from "bun:test"
import { bashToolCheckPermission } from "@/runtime/tools/builtins/bash/bashPermissions.js"
test("dummy", () => {
  expect(bashToolCheckPermission).toBeDefined()
})
