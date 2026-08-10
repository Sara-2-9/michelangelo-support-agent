/**
 * UserMenu — account panel (signed-in users only).
 *
 * The header button opens a RIGHT slide-over panel (mirroring the
 * conversation sidebar's overlay pattern, but from the right): profile
 * picture top-center when the provider gave us one (Google OAuth stores
 * it in user_metadata), the account email, and at the bottom the account
 * actions — Sign out and Delete Account — followed by the legal block
 * (AI disclaimer + Privacy/Terms links), which lives HERE instead of a
 * site footer: in a full-height chat layout a footer would ride up with
 * the mobile keyboard, and this panel keeps it one tap away without
 * stealing vertical space from the conversation.
 *
 * Delete Account opens a confirmation dialog first (title "Delete
 * Account", body "Are you sure?"): only the confirm button calls the
 * Worker's DELETE /api/account, which removes the auth user and — via
 * FK cascade — the whole conversation history. Afterwards a fresh
 * anonymous session starts (see auth context), so this component unmounts.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket, faTriangleExclamation, faUser } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/context/auth";
import Button from "@/components/ui/button";

/** Google (and other OAuth providers) expose the avatar in user_metadata. */
function avatarUrlFrom(session: ReturnType<typeof useAuth>["session"]): string | null {
  const meta = session?.user.user_metadata as Record<string, unknown> | undefined;
  const url = meta?.avatar_url ?? meta?.picture;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export default function UserMenu() {
  const { session, resetIdentity, deleteAccount } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = avatarUrlFrom(session);

  const avatar = avatarUrl ? (
    <img
      src={avatarUrl}
      alt="Profile picture"
      referrerPolicy="no-referrer"
      className="h-full w-full rounded-full object-cover"
    />
  ) : (
    <FontAwesomeIcon icon={faUser} />
  );

  function closePanel() {
    setPanelOpen(false);
    setError(null);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const err = await deleteAccount();
    if (err) {
      // On success the identity resets and this component unmounts — only
      // the failure path keeps rendering.
      setDeleting(false);
      setError(err);
    }
  }

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        aria-label="Account menu"
        aria-expanded={panelOpen}
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-btn-light text-icon-dark shadow transition-transform hover:scale-105"
      >
        {avatar}
      </button>

      {/* Backdrop — same overlay pattern as the conversation sidebar */}
      {panelOpen && <div className="fixed inset-0 z-20 bg-black/20" onClick={closePanel} />}

      <aside
        className={`fixed inset-y-0 right-0 z-30 flex w-72 flex-col rounded-l-2xl bg-grad-violet pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Profile picture top-center (or the generic icon as fallback) */}
        <div className="flex justify-center p-6 pb-3">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-btn-light text-2xl text-icon-dark shadow">
            {avatar}
          </div>
        </div>

        <p className="m-0 max-w-full truncate px-4 text-center text-sm font-medium break-all text-black">
          <span className="text-black/60">Email: </span>
          {session?.user.email}
        </p>

        {error && <p className="m-0 px-6 pt-3 text-center text-[13px] font-medium text-red-900">⚠️ {error}</p>}

        <div className="flex-1" />

        {/* Account actions, bottom */}
        <div className="flex flex-col gap-2.5 p-4 pb-3">
          <Button onClick={resetIdentity} variant="surface" icon={faArrowRightFromBracket}>
            Sign out
          </Button>
          <Button onClick={() => setConfirming(true)} variant="danger" icon={faTriangleExclamation}>
            Delete Account
          </Button>
        </div>

        {/* Legal block — the app's "footer", one tap away from anywhere */}
        <div className="border-t border-black/15 px-4 pt-2.5 pb-4">
          <p className="m-0 text-center text-[11px] leading-snug text-black/50">
            AI answers may be inaccurate — verify with the cited docs. Unofficial project, not
            affiliated with Michelangelo.
          </p>
          <nav aria-label="Legal" className="mt-1.5 flex justify-center gap-4 text-[11px]">
            <Link
              to="/privacy"
              onClick={closePanel}
              className="text-black/60 underline transition-colors hover:text-black"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              onClick={closePanel}
              className="text-black/60 underline transition-colors hover:text-black"
            >
              Terms
            </Link>
          </nav>
        </div>
      </aside>

      {/* Confirmation dialog — deletion is irreversible, so it needs an
          explicit second step. */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-border-ui bg-surface p-6 shadow-2xl"
          >
            <h2 id="delete-account-title" className="m-0 text-lg font-semibold text-white">
              Delete Account
            </h2>
            <p className="m-0 text-sm text-white/70">Are you sure?</p>
            <div className="mt-1 flex gap-2.5">
              <Button onClick={() => setConfirming(false)} disabled={deleting} variant="surface" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleDelete} disabled={deleting} variant="danger" className="flex-1">
                {deleting ? "Deleting…" : "Delete Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
