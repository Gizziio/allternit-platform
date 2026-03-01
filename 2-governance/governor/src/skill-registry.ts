export interface NetworkSkill {
  id: string;
  name: string;
  description: string;
  urlPattern: string;
  method: string;
  requiredHeaders: string[];
  responseMapping: Record<string, string>; // Maps JSON keys to agent variables
}

export class SkillRegistry {
  private skills: Map<string, NetworkSkill> = new Map();

  registerSkill(skill: NetworkSkill) {
    this.skills.set(skill.id, skill);
  }

  findSkillForUrl(url: string): NetworkSkill | undefined {
    return Array.from(this.skills.values()).find(s => new RegExp(s.urlPattern).test(url));
  }

  getSkills(): NetworkSkill[] {
    return Array.from(this.skills.values());
  }
}
