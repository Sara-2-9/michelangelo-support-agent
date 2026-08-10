/**
 * ChatHeader — restyle step 3 (Figma mockups 1/3).
 *
 * bars-sort button (always visible, opens the sidebar overlay) on the
 * left, title + subtitle centered, account action on the right: a
 * surface/border "Sign in" link to /auth for anonymous visitors, or the
 * avatar UserMenu for signed-in users.
 */

import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBarsStaggered } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/context/auth";
import UserMenu from "@/components/user-menu";

export default function ChatHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { isAnonymous } = useAuth();

  return (
    <header className="relative flex items-center justify-between px-1 py-4">
      <button
        onClick={onMenuClick}
        aria-label="Open conversation history"
        className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10"
      >
        <FontAwesomeIcon icon={faBarsStaggered} size="lg" />
      </button>

      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
        <h1 className="m-0 text-lg font-bold text-white drop-shadow-md">Michelangelo Support</h1>
        <p className="m-0 mt-0.5 hidden text-[13px] text-white/85 sm:block">
          Answers grounded in the official docs, with sources.
        </p>
      </div>

      {isAnonymous ? (
        <Link
          to="/auth"
          className="rounded-xl border border-border-ui bg-surface px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          Sign in
        </Link>
      ) : (
        <UserMenu />
      )}
    </header>
  );
}
