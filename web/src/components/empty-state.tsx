/** Shown when the conversation is empty — sets expectations + an example. */
export default function EmptyState() {
  return (
    <div className="m-auto text-center text-white drop-shadow-md">
      <p className="font-medium">Ask anything about Michelangelo — features, limits, integrations, API.</p>
      <p className="mt-1 text-[13px] text-white/75">e.g. "How many images can I attach to a prompt?"</p>
    </div>
  );
}
