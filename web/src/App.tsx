/**
 * App — composition only. Auth identity lives in AuthProvider, chat state
 * in ChatProvider, each piece of the UI is a component, HTTP in lib/api.ts,
 * direct DB reads in lib/supabase.ts (RLS-scoped).
 *
 * Identity changes (sign out → fresh anonymous user, or login into another
 * account) REMOUNT the whole chat subtree via key={userId}: messages,
 * composer draft and conversation state reset to a clean slate — nothing
 * from the previous identity can leak into the new one.
 */

import { useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/auth";
import { ChatProvider } from "@/context/chat";
import { STORAGE_KEY } from "@/constants/intents";
import ConversationSidebar from "@/components/conversation-sidebar";
import ChatHeader from "@/components/chat-header";
import MessageList from "@/components/message-list";
import Composer from "@/components/composer";
import AuthPage from "@/pages/auth-page";

function Shell() {
  const { ready } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center text-white">Loading…</div>
    );
  }

  return (
    // h-dvh: tracks the REAL visible height on mobile (unlike h-screen,
    // which ignores Safari's collapsing toolbar). Safe-area insets keep
    // content clear of the notch and the home indicator.
    <div className="relative flex h-dvh pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <ConversationSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-4">
        <ChatHeader onMenuClick={() => setSidebarOpen(true)} />
        <MessageList />
        <Composer />
      </div>
    </div>
  );
}

function AuthedApp() {
  const { userId } = useAuth();
  const prevUserId = useRef(userId);

  // Clear the stored conversationId BEFORE the remount below reads it —
  // it belongs to the previous identity and could never pass the Worker's
  // ownership check. Render-phase on purpose: it must run before the new
  // ChatProvider's initial state is computed.
  if (prevUserId.current !== userId) {
    prevUserId.current = userId;
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <ChatProvider key={userId ?? "boot"}>
      <Routes>
        <Route path="/" element={<Shell />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}
