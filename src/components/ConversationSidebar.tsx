import { formatRelativeTime } from "@/formatTime";
import type { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
}: Props) {
  const sorted = [...conversations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <aside className="sidebar" aria-label="Conversations">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Conversations</h2>
      </div>
      <ul className="conversation-list" role="listbox" aria-activedescendant={selectedId ?? undefined}>
        {sorted.map((c) => {
          const active = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                type="button"
                id={c.id}
                role="option"
                aria-selected={active}
                className={`conversation-item${active ? " active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <div className="conversation-item-title">{c.title}</div>
                <div className="conversation-item-preview">{c.preview}</div>
                <div className="conversation-meta">
                  {formatRelativeTime(c.updatedAt)}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
