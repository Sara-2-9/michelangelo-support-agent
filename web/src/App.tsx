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
import { ChatProvider, useChat } from "@/context/chat";
import { STORAGE_KEY } from "@/constants/intents";
import ConversationSidebar from "@/components/conversation-sidebar";
import ChatHeader from "@/components/chat-header";
import MessageList from "@/components/message-list";
import EmptyState from "@/components/empty-state";
import Composer from "@/components/composer";
import AppFooter from "@/components/app-footer";
import CookieBanner from "@/components/cookie-banner";
import AuthPage from "@/pages/auth-page";
import LegalPage from "@/pages/legal-page";
import {
  PRIVACY_LAST_UPDATED,
  PRIVACY_POLICY,
  TERMS_LAST_UPDATED,
  TERMS_OF_SERVICE,
} from "@/constants/legal";

function Shell() {
  const { ready } = useAuth();
  const { messages } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center text-white">Loading…</div>
    );
  }

  const empty = messages.length === 0;

  return (
    // h-dvh: tracks the REAL visible height on mobile (unlike h-screen,
    // which ignores Safari's collapsing toolbar). Safe-area insets keep
    // content clear of the notch and the home indicator.
    <div className="relative flex h-dvh pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <ConversationSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="mx-auto flex w-full max-w-205 flex-1 flex-col px-4">
        <ChatHeader onMenuClick={() => setSidebarOpen(true)} />
        {empty ? (
          // No messages yet: the composer sits CENTERED (ChatGPT-style
          // landing) and the legal footer is pinned to the bottom. After
          // the first send the standard chat layout takes over and the
          // footer leaves the stage.
          <>
            <main className="flex flex-1 flex-col justify-center gap-5 overflow-y-auto px-1 py-5">
              <EmptyState />
              <Composer />
            </main>
            <AppFooter />
          </>
        ) : (
          <>
            <MessageList />
            <Composer />
          </>
        )}
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
        <Route
          path="/privacy"
          element={
            <LegalPage title="Privacy Policy" lastUpdated={PRIVACY_LAST_UPDATED} body={PRIVACY_POLICY} />
          }
        />
        <Route
          path="/terms"
          element={
            <LegalPage title="Terms of Service" lastUpdated={TERMS_LAST_UPDATED} body={TERMS_OF_SERVICE} />
          }
        />
      </Routes>
      <CookieBanner />
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
