export default function ChatHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-1 py-4">
      <button
        onClick={onMenuClick}
        aria-label="Open conversation history"
        className="rounded-lg border border-border px-2.5 py-1.5 text-sm md:hidden"
      >
        ☰
      </button>
      <div>
        <h1 className="m-0 text-lg font-semibold">Michelangelo Support</h1>
        <p className="mt-1 text-[13px] text-muted">
          Answers grounded in the official docs, with sources.
        </p>
      </div>
    </header>
  );
}
