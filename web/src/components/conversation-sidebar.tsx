import { useState } from "react";
import { useAuth } from "@/context/auth";
import { useChat } from "@/context/chat";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Conversation history + account section. Hidden overlay on mobile, fixed on desktop. */
export default function ConversationSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAnonymous, claimEmail, resetIdentity, session } = useAuth();
  const { conversations, conversationId, selectConversation, newConversation } = useChat();

  const [email, setEmail] = useState("");
  const [claimState, setClaimState] = useState<"idle" | "sent" | "error">("idle");
  const [claimError, setClaimError] = useState<string | null>(null);

  async function handleClaim() {
    if (!email.trim()) return;
    const error = await claimEmail(email.trim());
    setClaimState(error ? "error" : "sent");
    setClaimError(error);
  }

  function openConversation(id: string) {
    selectConversation(id);
    onClose(); // on mobile, close the overlay after selecting
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-bg transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-border p-3">
          <button
            onClick={() => {
              newConversation();
              onClose();
            }}
            className="w-full rounded-lg border border-border px-3 py-2 text-[13px] font-medium hover:border-accent"
          >
            + New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && (
            <p className="p-2 text-[13px] text-muted">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                c.id === conversationId ? "bg-panel text-text" : "text-muted hover:bg-panel/60"
              }`}
            >
              <span>{formatDate(c.started_at)}</span>
              {c.escalated && <span className="text-[11px] text-warn">escalated</span>}
            </button>
          ))}
        </div>

        <div className="border-t border-border p-3 text-[13px]">
          {isAnonymous ? (
            claimState === "sent" ? (
              <p className="text-accent">Check your inbox to confirm ✉️</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="m-0 text-muted">Save your history:</p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="rounded-lg border border-border bg-panel px-2.5 py-1.5 text-text placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={handleClaim}
                  className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-[#0b0e14]"
                >
                  Email me a sign-in link
                </button>
                {claimState === "error" && <p className="m-0 text-danger">{claimError}</p>}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="m-0 truncate text-muted">{session?.user.email}</p>
              <button onClick={resetIdentity} className="text-left text-muted hover:text-text">
                Sign out & start fresh
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
