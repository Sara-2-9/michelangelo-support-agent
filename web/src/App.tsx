/**
 * App — composition only. State lives in ChatProvider (context/chat.tsx),
 * each piece of the UI is a component, HTTP lives in lib/api.ts.
 */

import { ChatProvider } from "@/context/chat";
import ChatHeader from "@/components/chat-header";
import MessageList from "@/components/message-list";
import Composer from "@/components/composer";

export default function App() {
  return (
    <ChatProvider>
      <div className="mx-auto flex h-screen max-w-[820px] flex-col px-4">
        <ChatHeader />
        <MessageList />
        <Composer />
      </div>
    </ChatProvider>
  );
}
