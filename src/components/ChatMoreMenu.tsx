"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  /** Shown to screen readers on the ⋮ trigger (e.g. chat title). */
  conversationLabel: string;
  onDelete?: () => void;
  /** Fork this thread into a new conversation (omit when there is nothing to copy). */
  onBranch?: () => void;
  /** Open rename flow for this conversation. */
  onRename?: () => void;
  /** Wider touch target in the main chat header; compact on message rows. */
  variant?: "sidebar" | "header" | "message";
};

export function ChatMoreMenu({
  conversationLabel,
  onDelete,
  onBranch,
  onRename,
  variant = "sidebar",
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const tipVisible = (hover || focus) && !open;

  const updateTipPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    setTipPos({
      left: r.left + r.width / 2,
      top: r.bottom + gap,
    });
  }, []);

  const primeTipPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    setTipPos({
      left: r.left + r.width / 2,
      top: r.bottom + gap,
    });
  }, []);

  useLayoutEffect(() => {
    if (!mounted || !tipVisible) return;
    updateTipPosition();
    window.addEventListener("scroll", updateTipPosition, true);
    window.addEventListener("resize", updateTipPosition);
    return () => {
      window.removeEventListener("scroll", updateTipPosition, true);
      window.removeEventListener("resize", updateTipPosition);
    };
  }, [mounted, tipVisible, updateTipPosition]);

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

  const tooltipPortal =
    mounted &&
    tipVisible &&
    tipPos &&
    createPortal(
      <div
        className="chat-tooltip-floater"
        style={{
          position: "fixed",
          left: tipPos.left,
          top: tipPos.top,
          transform: "translateX(-50%)",
          zIndex: 10100,
        }}
        role="tooltip"
      >
        {triggerTitle}
      </div>,
      document.body,
    );

  return (
    <div className="chat-more-wrap" ref={wrapRef}>
      {tooltipPortal}
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-label={
          variant === "message"
            ? `Branch from this message (${conversationLabel})`
            : `More actions for “${conversationLabel}”`
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseEnter={() => {
          primeTipPosition();
          setHover(true);
        }}
        onMouseLeave={() => {
          setHover(false);
          setTipPos(null);
        }}
        onFocus={() => {
          primeTipPosition();
          setFocus(true);
        }}
        onBlur={() => {
          setFocus(false);
          setTipPos(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
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
              {variant === "message" ? "Branch from here" : "Branch"}
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
