/**
 * ConfirmDialog — the app's destructive-action confirmation.
 *
 * Same visual language as the Delete Account dialog: centered card over a
 * dimmed backdrop, Cancel (surface) + Confirm (danger). Used wherever an
 * irreversible action needs an explicit second step (account deletion,
 * conversation deletion, …). Escape and the Cancel button dismiss it;
 * `loading` disables both buttons while the action runs and `error`
 * surfaces a failure without closing the dialog.
 */

import { useEffect } from "react";
import Button from "@/components/ui/button";

interface ConfirmDialogProps {
  title: string;
  body: string;
  /** Label of the danger confirm button (e.g. "Delete", "Delete Account"). */
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  /** Shown inside the dialog when the action failed (dialog stays open). */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Escape dismisses — but never while the action is in flight.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-border-ui bg-surface p-6 shadow-2xl"
      >
        <h2 id="confirm-dialog-title" className="m-0 text-lg font-semibold text-white">
          {title}
        </h2>
        <p className="m-0 text-sm text-white/70">{body}</p>
        {error && <p className="m-0 text-[13px] font-medium text-danger">⚠️ {error}</p>}
        <div className="mt-1 flex gap-2.5">
          <Button onClick={onCancel} disabled={loading} variant="surface" className="flex-1">
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={loading} variant="danger" className="flex-1">
            {loading ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
