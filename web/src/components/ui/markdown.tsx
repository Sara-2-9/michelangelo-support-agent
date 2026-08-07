/**
 * Markdown renderer for assistant messages (restyle — rich answers).
 *
 * The agent answers in markdown (bold, lists, links, code): rendering it
 * raw would show literal "**" and "[label](url)" to the user. Same stack
 * as our reference project: react-markdown + @tailwindcss/typography
 * (`prose` classes). Links open in a new tab, are tinted brand-blue, and
 * any leftover ".md" docs suffix (old DB rows) is stripped defensively —
 * new answers already get clean URLs from the retrieval layer.
 */

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href?.replace(/\.md($|#)/, "$1")}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[#4d9fff] hover:underline"
    >
      {children}
    </a>
  ),
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:bg-black/40 prose-code:text-[#ffd36d]">
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
