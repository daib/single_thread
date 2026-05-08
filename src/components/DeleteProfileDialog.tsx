"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  displayName: string;
  handle: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function DeleteProfileDialog({
  open,
  displayName,
  handle,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  const submit = async () => {
    setPending(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="delete-profile-dialog-root">
      <div
        className="delete-profile-dialog-backdrop"
        role="presentation"
        onClick={() => !pending && onClose()}
      />
      <div
        className="delete-profile-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby="delete-profile-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="delete-profile-dialog-title">
          Delete profile?
        </h2>
        <p id="delete-profile-desc" className="delete-profile-dialog-body">
          Remove <strong>{displayName}</strong>{" "}
          <span className="delete-profile-dialog-handle">@{handle}</span> and{" "}
          <strong>all chats</strong> stored for this persona. This cannot be undone.
        </p>
        <div className="delete-profile-actions">
          <button type="button" className="delete-profile-cancel" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="delete-profile-confirm" disabled={pending} onClick={submit}>
            {pending ? "Deleting…" : "Delete profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
