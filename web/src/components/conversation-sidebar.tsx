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
 * ANONYMOUS users can SEE their conversation list, but opening a past
 * conversation is reserved to signed-in users: the click redirects to
 * /auth instead, where claiming the account preserves the history.
 */

import { useNavigate } from "react-router-dom";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/context/auth";
import { useChat } from "@/context/chat";
import IconButton from "@/components/ui/icon-button";

export default function ConversationSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { conversations, conversationId, selectConversation, newConversation } = useChat();
  const { isAnonymous } = useAuth();
  const navigate = useNavigate();

  function openConversation(id: string) {
    onClose();
    if (isAnonymous) {
      // Signed-out visitors keep the list as a preview, but resuming a
      // conversation requires a permanent identity.
      navigate("/auth");
      return;
    }
    selectConversation(id);
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

        <div className="flex-1 overflow-y-auto p-3">
          {conversations.length === 0 && (
            <p className="p-2 text-[13px] text-black/50">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              title={c.preview ?? undefined}
              className={`mb-1.5 flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-[13px] transition-colors ${
                c.id === conversationId
                  ? "bg-black/25 text-black"
                  : "bg-black/10 text-black/75 hover:bg-black/20"
              }`}
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
          ))}
        </div>
      </aside>
    </>
  );
}
