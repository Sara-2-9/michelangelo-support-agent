/**
 * Conversation sidebar — restyle step 5 (Figma mockups 7/8).
 *
 * Overlay panel (all breakpoints) with a milky translucent look over the
 * animated gradient. Top row: the app icon on the left (brand anchor —
 * tells the user which app they are in) and the circled "+" new-chat
 * button on the right. Each entry is a pill showing the BEGINNING OF THE
 * FIRST USER MESSAGE of that conversation (not the date) — the preview
 * comes from the embedded PostgREST query in chat context.
 *
 * Each row has an ELLIPSIS button on its right edge: ALWAYS VISIBLE on
 * touch breakpoints (< md, where hover does not exist), revealed on row
 * hover (or keyboard focus / while its menu is open) from md up. It opens
 * a small menu with two per-conversation actions:
 *   - Share  → creates/reuses the public read-only link (Worker,
 *     ownership-checked) and copies it to the clipboard
 *   - Delete → ConfirmDialog, then DELETE /api/conversations/:id via chat
 *     context (messages cascade server-side; the open chat resets if it
 *     was the deleted one)
 * The menu is FIXED-positioned from the ellipsis button's rect so it is
 * never clipped by the list's overflow-y-auto, and closes on outside
 * click, Escape or list scroll.
 *
 * ANONYMOUS visitors see NO conversation list (branch no-anon-history):
 * their chats are persisted server-side but never surfaced. In place of
 * the list they get a compact SIGN-IN INVITATION spelling out the
 * benefits of a permanent account (history across sessions and devices,
 * sharing). The chat itself keeps working without sign-in.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faEllipsis, faPlus, faShare, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/context/auth";
import { useChat } from "@/context/chat";
import { shareConversation } from "@/lib/api";
import IconButton from "@/components/ui/icon-button";
import ConfirmDialog from "@/components/ui/confirm-dialog";

/** Open ellipsis menu: which conversation + where to anchor (viewport px). */
interface MenuState {
  id: string;
  top: number;
  left: number;
}

const MENU_WIDTH = 176; // w-44

export default function ConversationSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { conversations, conversationId, selectConversation, newConversation, deleteConversation } =
    useChat();
  const { isAnonymous, session } = useAuth();

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openConversation(id: string) {
    onClose();
    selectConversation(id);
  }

  function closeMenu() {
    setMenu(null);
    setCopied(false);
    setMenuError(null);
  }

  /** Anchors the menu under the ellipsis button, clamped to the viewport. */
  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation();
    if (menu?.id === id) {
      closeMenu();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    closeMenu();
    setMenu({
      id,
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
  }

  // Escape closes the menu (the ConfirmDialog handles its own Escape).
  useEffect(() => {
    if (!menu) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menu]);

  /** Creates/reuses the public link and copies it; brief "copied" state. */
  async function handleShare(id: string) {
    const token = session?.access_token;
    if (!token || sharing) return;
    setSharing(true);
    setMenuError(null);
    try {
      const url = await shareConversation(id, token);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(closeMenu, 1200);
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : "Could not create the share link");
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteConversation(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete the conversation");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Backdrop — all breakpoints: the sidebar is an overlay */}
      {open && <div className="fixed inset-0 z-20 bg-black/20" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col rounded-r-2xl bg-grad-violet shadow-2xl transition-transform pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <img
            src="/icon-512.png"
            alt="Michelangelo Support Agent"
            className="h-9 w-9 rounded-xl shadow"
          />
          <IconButton
            onClick={() => {
              newConversation();
              onClose();
            }}
            icon={faPlus}
            label="New chat"
            className="bg-btn-light text-icon-dark"
          />
        </div>

        <div className="mx-4 border-t border-black/15" />

        {/* Scrolling the list would detach an open menu from its anchor —
            close it instead. */}
        <div className="flex-1 overflow-y-auto p-3" onScroll={closeMenu}>
          {isAnonymous ? (
            // No history for anonymous visitors — show WHY signing in is
            // worth it instead. The chat itself works either way.
            <div className="m-1 flex flex-col gap-2.5 rounded-xl bg-black/10 p-4">
              <p className="m-0 text-[13px] font-semibold text-black">Sign in to keep your chats</p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] leading-snug text-black/65">
                <li>· Conversations are saved — always here when you come back</li>
                <li>· Pick up where you left off, on any device</li>
                <li>· Share a conversation with a read-only link</li>
              </ul>
              <p className="m-0 text-[12px] leading-snug text-black/50">
                Without an account the chat works as usual, but disappears on reload.
              </p>
              <Link
                to="/auth"
                onClick={onClose}
                className="mt-1 rounded-xl bg-black/85 px-4 py-2 text-center text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              {conversations.length === 0 && (
                <p className="p-2 text-[13px] text-black/50">No conversations yet.</p>
              )}
              {conversations.map((c) => (
            <div
              key={c.id}
              className={`group mb-1.5 flex items-center gap-1 rounded-xl pr-1.5 transition-colors ${
                c.id === conversationId ? "bg-black/25 text-black" : "bg-black/10 text-black/75 hover:bg-black/20"
              }`}
            >
              <button
                onClick={() => openConversation(c.id)}
                title={c.preview ?? undefined}
                className="flex min-w-0 flex-1 items-center gap-2 px-3.5 py-2.5 text-left text-[13px]"
              >
                <span className="truncate">{c.preview ?? "New conversation"}</span>
                {c.escalated && (
                  <span
                    aria-label="Escalated to human support"
                    title="Escalated to human support"
                    className="ml-auto h-2 w-2 shrink-0 rounded-full bg-warn"
                  />
                )}
              </button>
              {/* Ellipsis — always visible on touch (no hover), hover/
                  focus-only from md up; stays visible while its own menu
                  is open. */}
              <button
                onClick={(e) => toggleMenu(e, c.id)}
                aria-label="Conversation options"
                aria-haspopup="menu"
                aria-expanded={menu?.id === c.id}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-black/70 transition-all hover:bg-black/20 ${
                  menu?.id === c.id
                    ? "bg-black/20 opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100"
                }`}
              >
                <FontAwesomeIcon icon={faEllipsis} className="text-xs" />
              </button>
            </div>
          ))}
            </>
          )}
        </div>
      </aside>

      {/* Ellipsis menu — fixed (never clipped by the scrollable list) */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            role="menu"
            aria-label="Conversation actions"
            className="fixed z-50 w-44 rounded-xl border border-border-ui bg-surface p-1.5 shadow-2xl"
            style={{ top: menu.top, left: menu.left }}
          >
            <button
              role="menuitem"
              onClick={() => void handleShare(menu.id)}
              disabled={sharing}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={copied ? faCheck : faShare} className="w-3.5" />
              {copied ? "Link copied!" : sharing ? "Creating link…" : "Share"}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setConfirmDeleteId(menu.id);
                setDeleteError(null);
                closeMenu();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-danger transition-colors hover:bg-white/10"
            >
              <FontAwesomeIcon icon={faTrash} className="w-3.5" />
              Delete
            </button>
            {menuError && <p className="m-0 px-3 pt-1 pb-0.5 text-[11px] text-danger">⚠️ {menuError}</p>}
          </div>
        </>
      )}

      {/* Deletion is irreversible — explicit second step (same pattern as
          Delete Account in the user menu). */}
      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete chat"
          body="Are you sure? This conversation and its messages will be permanently deleted."
          confirmLabel="Delete"
          loading={deleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </>
  );
}
