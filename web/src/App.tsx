/**
 * App — composition only. Auth identity lives in AuthProvider, chat state
 * in ChatProvider, each piece of the UI is a component, HTTP in lib/api.ts,
 * direct DB reads in lib/supabase.ts (RLS-scoped).
 */

import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/auth";
import { ChatProvider } from "@/context/chat";
import ConversationSidebar from "@/components/conversation-sidebar";
import ChatHeader from "@/components/chat-header";
import MessageList from "@/components/message-list";
import Composer from "@/components/composer";

function Shell() {
  const { ready } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-muted">Loading…</div>
    );
  }

  return (
    <div className="flex h-screen">
      <ConversationSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-4">
        <ChatHeader onMenuClick={() => setSidebarOpen(true)} />
        <MessageList />
        <Composer />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Shell />
      </ChatProvider>
    </AuthProvider>
  );
}
