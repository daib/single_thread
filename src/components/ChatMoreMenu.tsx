"use client";

import { useEffect, useRef, useState } from "react";
import { PortalTooltipButton } from "@/components/PortalTooltipButton";

type Props = {
  /** Shown to screen readers on the ⋮ trigger (e.g. chat title). */
  conversationLabel: string;
  onDelete?: () => void;
  /** Fork this thread into a new conversation (omit when there is nothing to copy). */
  onBranch?: () => void;
  /** Open rename flow for this conversation. */
  onRename?: () => void;
  /** Download full thread (e.g. JSON export). Sidebar/header only. */
  onDownload?: () => void;
  /** Wider touch target in the main chat header; compact on message rows. */
  variant?: "sidebar" | "header" | "message";
};

export function ChatMoreMenu({
  conversationLabel,
  onDelete,
  onBranch,
  onRename,
  onDownload,
  variant = "sidebar",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isInstantBranch = variant === "message";

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
    variant === "header"
      ? "chat-more-trigger chat-more-trigger-header"
      : variant === "message"
        ? "chat-more-trigger chat-more-trigger-message"
        : "chat-more-trigger";

  const truncatedLabel =
    conversationLabel.length > 72
      ? `${conversationLabel.slice(0, 71)}…`
      : conversationLabel;
  const triggerTitle =
    variant === "message"
      ? "Branch from this message"
      : `More options — ${truncatedLabel}`;

  return (
    <div className="chat-more-wrap" ref={wrapRef}>
      <PortalTooltipButton
        tooltip={triggerTitle}
        ariaLabel={
          variant === "message"
            ? `Branch from this message (${conversationLabel})`
            : `More actions for “${conversationLabel}”`
        }
        className={triggerClass}
        aria-expanded={isInstantBranch ? undefined : open}
        aria-haspopup={isInstantBranch ? undefined : "menu"}
        hideTooltip={!isInstantBranch && open}
        onClick={(e) => {
          e.stopPropagation();
          if (isInstantBranch) {
            onBranch?.();
            return;
          }
          setOpen((v) => !v);
        }}
      >
        {variant === "message" ? (
          <span aria-hidden className="chat-more-branch-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" x2="6" y1="3" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9v1a2 2 0 0 1-2 2H8l-4 4" />
            </svg>
          </span>
        ) : (
          <span aria-hidden className="chat-more-dots">
            <span className="chat-more-dot" />
            <span className="chat-more-dot" />
            <span className="chat-more-dot" />
          </span>
        )}
      </PortalTooltipButton>
      {open && !isInstantBranch ? (
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
          {onDownload ? (
            <button
              type="button"
              className="chat-more-item"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
                setOpen(false);
              }}
            >
              Download
            </button>
          ) : null}
          {onDelete ? (
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
