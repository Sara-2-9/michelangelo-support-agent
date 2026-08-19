/**
 * AppFooter — legal block shown ONLY under the centered empty-state
 * layout (no messages yet): AI-accuracy / non-affiliation disclaimer +
 * Privacy/Terms links, pinned to the bottom of the page.
 *
 * Once the first message exists the composer drops to the bottom and
 * this footer disappears (signed-in users still have the same links in
 * the account panel, everyone has them on /auth).
 *
 * `peer-focus-within:hidden` hides it while the composer textarea is
 * focused, so on iOS it never rides up with the on-screen keyboard.
 */

import { Link } from "react-router-dom";

export default function AppFooter() {
  return (
    <footer className="animate-enter border-t border-white/10 px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] peer-focus-within:hidden [animation-delay:240ms]">
      <p className="m-0 text-center text-xs text-white/35">
        AI answers may be inaccurate — verify with the cited docs. Unofficial project, not affiliated
        with Michelangelo.
      </p>
      <nav aria-label="Legal" className="mt-1 flex justify-center gap-4 text-xs text-white/45">
        <Link to="/privacy" className="underline transition-colors hover:text-white">
          Privacy
        </Link>
        <Link to="/terms" className="underline transition-colors hover:text-white">
          Terms
        </Link>
      </nav>
    </footer>
  );
}
