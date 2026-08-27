import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

export default function TagsPanel() {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const searchFor = useStore((s) => s.searchFor);

  useEffect(() => {
    api.tags().then((r) => setTags(r.tags)).catch(() => {});
  }, []);

  return (
    <div style={{ padding: 8 }}>
      {tags.length === 0 && <div style={{ color: 'var(--text-faint)', padding: 8 }}>No tags found</div>}
      {tags.map((t) => (
        <span
          key={t.tag}
          className="tag-pill"
          title={`Search #${t.tag}`}
          onClick={() => searchFor(`tag:${t.tag}`)}
        >
          #{t.tag} <span className="count">{t.count}</span>
        </span>
      ))}
    </div>
  );
}
