/**
 * /privacy and /terms — legal document pages.
 *
 * One renderer, two documents: content lives as markdown in
 * constants/legal.ts (single source of truth) and is rendered with the
 * same Markdown/prose stack used for assistant answers. Cross-links
 * between the two documents let users navigate the legal pair without
 * going back.
 *
 * "Back" returns to the page the user CAME FROM (chat, /auth, the account
 * panel…) via history navigation — not always to the chat. Direct visits
 * (no in-app history entry, e.g. opening the URL from the Google OAuth
 * consent screen) fall back to "/".
 */

import { Link, useNavigate } from "react-router-dom";
import Markdown from "@/components/ui/markdown";

type LegalPageProps = {
  title: string;
  lastUpdated: string;
  body: string;
};

export default function LegalPage({ title, lastUpdated, body }: LegalPageProps) {
  const navigate = useNavigate();

  function goBack() {
    // React Router stores the history index in window.history.state:
    // idx > 0 means there IS a previous in-app entry to return to.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  }

  return (
    <div className="min-h-dvh bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        <div className="flex items-center justify-between text-sm">
          <button onClick={goBack} className="text-white/50 transition-colors hover:text-white">
            ← Back
          </button>
          <nav className="flex gap-4 text-white/50">
            <Link to="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
          </nav>
        </div>
        <header>
          <h1 className="m-0 text-2xl font-semibold">{title}</h1>
          <p className="mt-1 mb-0 text-sm text-white/50">Last updated: {lastUpdated}</p>
        </header>
        <Markdown>{body}</Markdown>
      </div>
    </div>
  );
}
