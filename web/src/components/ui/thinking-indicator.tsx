/** Three pulsing dots — the "agent is thinking" indicator (~4s latency). */
export default function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.75 w-1.75 animate-pulse rounded-full bg-btn-light"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  );
}
