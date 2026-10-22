import React from "react";
import { Modal } from "./Modal";
import { Button } from "../primitives";

/** Styled Modal replacement for window.confirm() on destructive actions. */
export function ConfirmModal({
  title,
  body,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  pending,
  onConfirm,
  onCancel,
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      width={420}
      title={title}
      onClose={onCancel}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button kind="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button kind={danger ? "danger" : "primary"} onClick={onConfirm} disabled={pending} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {body && (
        <div style={{ padding: 24, color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.5 }}>{body}</div>
      )}
    </Modal>
  );
}
