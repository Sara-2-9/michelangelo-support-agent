/**
 * CookieBanner — consent choice shown on first visit, on every page.
 *
 * Honest by design: the app uses ONLY strictly-necessary storage (the
 * sign-in session in localStorage) — no analytics, tracking, or
 * advertising cookies exist, so there is nothing optional to switch off.
 * The banner tells the user exactly that and records their choice
 * ("accepted" | "rejected") in localStorage; it never appears again
 * afterwards. Details live in the Privacy Policy (linked).
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "@/components/ui/button";

const STORAGE_KEY = "cookie-consent";

export default function CookieBanner() {
  const [choice, setChoice] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  function decide(value: "accepted" | "rejected") {
    localStorage.setItem(STORAGE_KEY, value);
    setChoice(value);
  }

  if (choice) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="dialog"
        aria-label="Cookie consent"
        className="flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-border-ui bg-surface p-4 shadow-2xl"
      >
        <p className="m-0 text-[13px] leading-snug text-white/80">
          This site uses only strictly necessary storage to keep you signed in — no tracking or
          advertising cookies. Details in the{" "}
          <Link to="/privacy" className="underline transition-colors hover:text-white">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="surface" onClick={() => decide("rejected")}>
            Reject
          </Button>
          <Button variant="light" onClick={() => decide("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
