/**
 * Comment-mode surgical edits — ported from nexu-io/open-design.
 *
 * Users attach comments to an artifact preview. Each comment becomes a
 * targeted instruction the agent applies without regenerating the whole
 * artifact. Comments are serialized as `[comment id="..." target="..."]...[/comment]`
 * blocks sent to the agent.
 */

export interface SurgicalComment {
  id: string;
  target: string;
  body: string;
  resolved: boolean;
  createdAt: string;
}

export interface SurgicalEditPayload {
  comments: SurgicalComment[];
  instruction: string;
}

export function parseSurgicalComments(markdown: string): SurgicalComment[] {
  const comments: SurgicalComment[] = [];
  const pattern = /\[comment\s+id="([^"]+)"\s+target="([^"]+)"\](.*?)\[\/comment\]/gs;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(markdown)) !== null) {
    comments.push({
      id: match[1],
      target: match[2],
      body: match[3].trim(),
      resolved: false,
      createdAt: new Date().toISOString(),
    });
  }
  return comments;
}

export function serializeSurgicalComment(comment: SurgicalComment): string {
  return `[comment id="${comment.id}" target="${comment.target}"]${comment.body}[/comment]`;
}

export function buildSurgicalEditPrompt(html: string, comments: SurgicalComment[]): string {
  const open = comments.filter((c) => !c.resolved);
  if (open.length === 0) return '';
  const serialized = open.map(serializeSurgicalComment).join('\n');
  return `Apply the following surgical edits to the artifact HTML. Make only the requested changes; preserve everything else exactly.\n\n${serialized}\n\nArtifact:\n\`\`\`html\n${html}\n\`\`\``;
}

export function generateCommentId(): string {
  return `comment-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
