import { Vcs } from "@/runtime/context/project/vcs";
import { Command } from "@/runtime/loop/command";
import { Agent } from "@/runtime/loop/agent";
import { Skill } from "@/runtime/skills/skill";
import { Log } from "@/shared/util/log";

console.log("Diagnostic: Checking core schemas...");

const checks = [
  { name: "Vcs.Info", value: Vcs.Info },
  { name: "Command.Info", value: Command.Info },
  { name: "Agent.Info", value: Agent.Info },
  { name: "Skill.Info", value: Skill.Info },
];

for (const check of checks) {
  if (check.value === undefined) {
    console.error(`FAIL: ${check.name} is undefined!`);
  } else {
    console.log(`OK: ${check.name} is defined.`);
  }
}
