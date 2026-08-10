/**
 * Shown when the conversation is empty — sets expectations + an example.
 * Rendered by the Shell ABOVE the centered composer (the legal disclaimer
 * and links live in AppFooter below it).
 */

export default function EmptyState() {
  return (
    <div className="text-center text-white drop-shadow-md">
      <p className="font-medium">
        Ask anything about{" "}
        <a
          href="https://michelangelo.land"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-white/50 underline-offset-2 transition-colors hover:text-white/80"
        >
          Michelangelo
        </a>{" "}
        — features, limits, integrations, API.
      </p>
      <p className="mt-1 text-[13px] text-white/75">e.g. "How many images can I attach to a prompt?"</p>
    </div>
  );
}
