"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Shown to screen readers on the ⋮ trigger (e.g. chat title). */
  conversationLabel: string;
  onDelete: () => void;
  /** Fork this thread into a new conversation (omit when there is nothing to copy). */
  onBranch?: () => void;
  /** Open rename flow for this conversation. */
  onRename?: () => void;
  /** Wider touch target in the main chat header. */
  variant?: "sidebar" | "header";
};

export function ChatMoreMenu({
  conversationLabel,
  onDelete,
  onBranch,
  onRename,
  variant = "sidebar",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass =
    variant === "header" ? "chat-more-trigger chat-more-trigger-header" : "chat-more-trigger";

  return (
    <div className="chat-more-wrap" ref={wrapRef}>
      <button
        type="button"
        className={triggerClass}
        aria-label={`More actions for “${conversationLabel}”`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span aria-hidden className="chat-more-dots">
          <span className="chat-more-dot" />
          <span className="chat-more-dot" />
          <span className="chat-more-dot" />
        </span>
      </button>
      {open ? (
        <div className="chat-more-dropdown" role="menu">
          {onRename ? (
            <button
              type="button"
              className="chat-more-item"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onRename();
                setOpen(false);
              }}
            >
              Rename
            </button>
          ) : null}
          {onBranch ? (
            <button
              type="button"
              className="chat-more-item"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onBranch();
                setOpen(false);
              }}
            >
              Branch
            </button>
          ) : null}
          <button
            type="button"
            className="chat-more-item chat-more-item-danger"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setOpen(false);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
