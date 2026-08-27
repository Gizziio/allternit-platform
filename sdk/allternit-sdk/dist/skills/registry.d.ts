export interface ProgressiveDisclosureLevel {
    name?: string;
    trigger?: string;
    tools?: string[];
}
export interface SkillManifest {
    name: string;
    version: string;
    description: string;
    tools: string[];
    entrypoint: string;
    progressive_disclosure?: {
        levels?: ProgressiveDisclosureLevel[];
    };
}
export interface LoadedSkill {
    /** Canonical skill name from the manifest. */
    id: string;
    /** Absolute path to the skill directory. */
    dir: string;
    /** Parsed and validated manifest. */
    manifest: SkillManifest;
    /** Raw text of the progressive disclosure section, if any. */
    progressiveDisclosure: string;
}
/**
 * Validate that a parsed object conforms to the SKILL.md manifest contract.
 */
export declare function validateSkillManifest(manifest: unknown): SkillManifest;
/**
 * Parse a SKILL.md file into its manifest and progressive-disclosure body.
 */
export declare function parseSkillMarkdown(text: string): {
    manifest: SkillManifest;
    progressiveDisclosure: string;
};
export interface LoadSkillsResult {
    skills: LoadedSkill[];
    errors: string[];
}
/**
 * Load all skill packages from a directory.
 *
 * Defaults to `~/.allternit/skills/`.
 */
export declare function loadSkills(skillsDir?: string): Promise<LoadSkillsResult>;
