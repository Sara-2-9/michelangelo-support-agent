/** Shown when the conversation is empty — sets expectations + an example. */
export default function EmptyState() {
  return (
    <div className="m-auto text-center text-muted">
      <p>Ask anything about Michelangelo — features, limits, integrations, API.</p>
      <p className="text-[13px] opacity-80">e.g. "How many images can I attach to a prompt?"</p>
    </div>
  );
}
