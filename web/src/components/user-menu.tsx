/**
 * UserMenu — restyle step 3 (Figma mockup 8).
 *
 * Signed-in users see a light circular avatar (btn-light) in the header.
 * Clicking it toggles a dark popover with the account email and a Sign out
 * button. Closes on outside click or Escape. Click (not hover) is used on
 * purpose: it works on touch screens too, where hover does not exist.
 */

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/context/auth";

export default function UserMenu() {
  const { session, resetIdentity } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-btn-light text-icon-dark shadow transition-transform hover:scale-105"
      >
        <FontAwesomeIcon icon={faUser} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 flex w-56 flex-col items-center gap-3 rounded-2xl border border-border-ui bg-linear-to-br from-grad-blue via-grad-violet to-grad-pink p-4 shadow-xl">
          <p className="m-0 max-w-full truncate text-sm font-medium text-black" title={session?.user.email ?? ""}>
            {session?.user.email}
          </p>
          <button
            onClick={resetIdentity}
            className="rounded-xl border border-border-ui bg-surface px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
