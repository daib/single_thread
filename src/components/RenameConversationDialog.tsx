"use client";

import { type FormEvent, useEffect, useId, useState } from "react";

const MAX_TITLE = 200;

type Props = {
  open: boolean;
  initialTitle: string;
  onClose: () => void;
  onConfirm: (title: string) => void | Promise<void>;
};

export function RenameConversationDialog({ open, initialTitle, onClose, onConfirm }: Props) {
  const [value, setValue] = useState(initialTitle);
  const headingId = useId();

  useEffect(() => {
    if (open) setValue(initialTitle);
  }, [open, initialTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (!t) return;
    await onConfirm(t.slice(0, MAX_TITLE));
  };

  return (
    <div className="rename-dialog-root">
      <div className="rename-dialog-backdrop" role="presentation" onClick={onClose} />
      <div
        className="rename-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={headingId} className="rename-dialog-title">
          Rename conversation
        </h2>
        <form onSubmit={submit}>
          <label htmlFor="rename-conversation-input" className="rename-dialog-label">
            Title
          </label>
          <input
            id="rename-conversation-input"
            className="rename-dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={MAX_TITLE}
            autoComplete="off"
            autoFocus
          />
          <div className="rename-dialog-actions">
            <button type="button" className="rename-dialog-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="rename-dialog-save" disabled={!value.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
