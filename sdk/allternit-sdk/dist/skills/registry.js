import { homedir } from 'node:os';
import { join } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
const SEMVER_RE = /^\d+\.\d+\.\d+/;
const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/;
function unquote(value) {
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}
function splitLines(text) {
    return text.split(/\r?\n/).map((line) => ({
        text: line,
        indent: line.length - line.trimStart().length,
    }));
}
function isBlankOrComment(line) {
    return line.text.trim() === '' || line.text.trim().startsWith('#');
}
function parseScalarValue(lines, start) {
    let i = start;
    while (i < lines.length && isBlankOrComment(lines[i]))
        i++;
    if (i >= lines.length)
        return { value: '', nextIndex: i };
    if (lines[i].text.trim().startsWith('- ')) {
        const seq = parseSequence(lines, i, lines[i].indent);
        return { value: seq.value, nextIndex: seq.nextIndex };
    }
    const childBase = lines[i].indent;
    const map = parseMapping(lines, i, childBase - 1);
    return { value: map.value, nextIndex: map.nextIndex };
}
function parseSequence(lines, start, baseIndent) {
    const value = [];
    let i = start;
    while (i < lines.length) {
        const line = lines[i];
        if (isBlankOrComment(line)) {
            i++;
            continue;
        }
        if (line.indent < baseIndent)
            break;
        const trimmed = line.text.trim();
        if (!trimmed.startsWith('-')) {
            if (line.indent <= baseIndent)
                break;
            i++;
            continue;
        }
        const itemText = trimmed.slice(1).trim();
        if (itemText === '') {
            // The array item is itself a nested collection.
            i++;
            let j = i;
            while (j < lines.length && isBlankOrComment(lines[j]))
                j++;
            if (j >= lines.length) {
                value.push('');
                continue;
            }
            const parsed = parseScalarValue(lines, j);
            value.push(parsed.value);
            i = parsed.nextIndex;
        }
        else if (/^[A-Za-z0-9_]+\s*:/.test(itemText)) {
            // Mapping-as-array-item (e.g. "- name: basic").
            const colonIndex = itemText.indexOf(':');
            const firstKey = itemText.slice(0, colonIndex).trim();
            let firstValue = itemText.slice(colonIndex + 1).trim();
            const item = {};
            i++;
            if (firstValue !== '' && firstValue !== '|' && firstValue !== '>') {
                item[firstKey] = unquote(firstValue);
            }
            else {
                const parsed = parseScalarValue(lines, i);
                item[firstKey] = parsed.value;
                i = parsed.nextIndex;
            }
            // Collect remaining keys that belong to this mapping item.
            while (i < lines.length) {
                const nextLine = lines[i];
                if (isBlankOrComment(nextLine)) {
                    i++;
                    continue;
                }
                if (nextLine.indent <= baseIndent)
                    break;
                const nextTrimmed = nextLine.text.trim();
                if (nextTrimmed.startsWith('-'))
                    break;
                const keyMatch = nextLine.text.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/);
                if (!keyMatch) {
                    i++;
                    continue;
                }
                const key = keyMatch[1];
                const after = keyMatch[2].trim();
                i++;
                if (after !== '' && after !== '|' && after !== '>') {
                    item[key] = unquote(after);
                }
                else {
                    const parsed = parseScalarValue(lines, i);
                    item[key] = parsed.value;
                    i = parsed.nextIndex;
                }
            }
            value.push(item);
        }
        else {
            value.push(unquote(itemText));
            i++;
        }
    }
    return { value, nextIndex: i };
}
function parseMapping(lines, start, baseIndent) {
    const value = {};
    let i = start;
    const keyRe = /^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/;
    while (i < lines.length) {
        const line = lines[i];
        if (isBlankOrComment(line)) {
            i++;
            continue;
        }
        if (baseIndent !== -1 && line.indent <= baseIndent)
            break;
        const match = line.text.match(keyRe);
        if (!match) {
            i++;
            continue;
        }
        const key = match[1];
        let after = match[2].trim();
        i++;
        if (after !== '' && after !== '|' && after !== '>') {
            value[key] = unquote(after);
            continue;
        }
        const parsed = parseScalarValue(lines, i);
        value[key] = parsed.value;
        i = parsed.nextIndex;
    }
    return { value, nextIndex: i };
}
function parseYaml(text) {
    const lines = splitLines(text);
    const { value } = parseMapping(lines, 0, -1);
    return value;
}
/**
 * Validate that a parsed object conforms to the SKILL.md manifest contract.
 */
export function validateSkillManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') {
        throw new Error('Skill manifest must be an object');
    }
    const m = manifest;
    function requireString(field) {
        const value = m[field];
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`Skill manifest missing or invalid required field: ${field}`);
        }
        return value.trim();
    }
    const name = requireString('name');
    const version = requireString('version');
    const description = requireString('description');
    const entrypoint = requireString('entrypoint');
    if (!SEMVER_RE.test(version)) {
        throw new Error(`Skill manifest version must follow major.minor.patch format: ${version}`);
    }
    const tools = m.tools;
    if (!Array.isArray(tools) || tools.length === 0 || !tools.every((t) => typeof t === 'string' && t.length > 0)) {
        throw new Error('Skill manifest tools must be a non-empty array of non-empty strings');
    }
    return {
        name,
        version,
        description,
        tools: tools,
        entrypoint,
        progressive_disclosure: m.progressive_disclosure,
    };
}
/**
 * Parse a SKILL.md file into its manifest and progressive-disclosure body.
 */
export function parseSkillMarkdown(text) {
    const match = text.match(FRONTMATTER_RE);
    if (!match) {
        throw new Error('SKILL.md must begin with YAML front matter delimited by ---');
    }
    const raw = parseYaml(match[1]);
    const manifest = validateSkillManifest(raw);
    const progressiveDisclosure = match[2].trim();
    return { manifest, progressiveDisclosure };
}
/**
 * Load all skill packages from a directory.
 *
 * Defaults to `~/.allternit/skills/`.
 */
export async function loadSkills(skillsDir = join(homedir(), '.allternit', 'skills')) {
    const result = { skills: [], errors: [] };
    let entries;
    try {
        const dirStat = await stat(skillsDir);
        if (!dirStat.isDirectory()) {
            return result;
        }
        entries = await readdir(skillsDir);
    }
    catch {
        return result;
    }
    for (const entry of entries) {
        const dir = join(skillsDir, entry);
        let dirStat;
        try {
            dirStat = await stat(dir);
            if (!dirStat.isDirectory())
                continue;
        }
        catch (err) {
            result.errors.push(`${entry}: ${err.message}`);
            continue;
        }
        const skillMdPath = join(dir, 'SKILL.md');
        try {
            const text = await readFile(skillMdPath, 'utf8');
            const { manifest, progressiveDisclosure } = parseSkillMarkdown(text);
            result.skills.push({
                id: manifest.name,
                dir,
                manifest,
                progressiveDisclosure,
            });
        }
        catch (err) {
            result.errors.push(`${entry}: ${err.message}`);
        }
    }
    return result;
}
