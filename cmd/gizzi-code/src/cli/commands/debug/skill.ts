import { EOL } from "os"
import { Skill } from "@/runtime/skills/skill"
import { bootstrap } from "@/cli/bootstrap/bootstrap"
import { cmd } from "@/cli/commands/cmd"

export const SkillCommand = cmd({
  command: "skill",
  describe: "list all available skills",
  builder: (yargs) => yargs,
  async handler() {
    await bootstrap(process.cwd(), async () => {
      const skills = await Skill.all()
      process.stdout.write(JSON.stringify(skills, null, 2) + EOL)
    })
  },
})
