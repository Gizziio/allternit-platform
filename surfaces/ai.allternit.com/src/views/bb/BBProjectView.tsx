//! bb-native project detail view.

import { useEffect, useState } from "react";
import {
  createBBThread,
  listBBEvents,
  listBBThreads,
  sendBBMessage,
  type BBApiThread,
} from "@/lib/agents/bb-sync";

export interface BBProjectViewProps {
  bbProjectId: string;
}

export function BBProjectView({ bbProjectId }: BBProjectViewProps) {
  const [threads, setThreads] = useState<BBApiThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [events, setEvents] = useState<unknown[]>([]);

  useEffect(() => {
    listBBThreads(bbProjectId).then((res) => setThreads(res.items));
  }, [bbProjectId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    listBBEvents(selectedThreadId).then((res) => setEvents(res.items));
  }, [selectedThreadId]);

  const handleCreateThread = async () => {
    const thread = await createBBThread({
      projectId: bbProjectId,
      input: [{ role: "user", content: "New bb thread" }],
    });
    setThreads((prev) => [thread, ...prev]);
    setSelectedThreadId(thread.id);
  };

  const handleSend = async () => {
    if (!selectedThreadId || !draft.trim()) return;
    await sendBBMessage(selectedThreadId, [{ role: "user", content: draft }]);
    setDraft("");
    const res = await listBBEvents(selectedThreadId);
    setEvents(res.items);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">bb Project</h2>
        <button
          type="button"
          onClick={handleCreateThread}
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          New Thread
        </button>
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-64 overflow-auto border-r pr-2">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setSelectedThreadId(thread.id)}
              className={`block w-full truncate text-left px-2 py-1 ${
                selectedThreadId === thread.id ? "bg-blue-100" : ""
              }`}
            >
              {thread.title ?? thread.id}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex-1 overflow-auto rounded border p-2">
            <pre className="text-xs">{JSON.stringify(events, null, 2)}</pre>
          </div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Send a message..."
              className="flex-1 rounded border px-2 py-1"
            />
            <button
              type="button"
              onClick={handleSend}
              className="rounded bg-blue-600 px-3 py-1 text-white"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
