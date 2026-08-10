/**
 * IconButton — the one round, icon-only button of the app.
 *
 * Used for the circular actions (new chat "+", send "↑"): shape, size and
 * interaction are shared; the caller picks the `icon` and, via className,
 * the colors and placement extras (e.g. the send button's absolute
 * positioning). Colors are NOT in the base classes on purpose: two
 * conflicting Tailwind color utilities would fight unpredictably.
 *
 * `label` is REQUIRED: an icon-only button is invisible to screen readers
 * without an accessible name.
 */

import type { ButtonHTMLAttributes } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconProp;
  /** Accessible name — required because there is no visible text. */
  label: string;
}

export default function IconButton({ icon, label, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full shadow transition-transform hover:scale-105 disabled:transform-none disabled:cursor-default disabled:opacity-40 ${className}`}
      {...rest}
    >
      <FontAwesomeIcon icon={icon} />
    </button>
  );
}
