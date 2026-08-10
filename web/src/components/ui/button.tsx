/**
 * Button — the one text button of the app.
 *
 * Replaces the four near-identical hand-styled buttons ("Email me a
 * sign-in link", "Continue with Google", "Sign out", "Delete Account")
 * with a single transportable component:
 *
 *   - `variant`      background/text color scheme (the Figma palette)
 *   - `icon`         optional FontAwesome icon
 *   - `iconPosition` "left" (default) | "right"
 *   - `iconSpin`     spinning animation (loading states)
 *
 * Every native <button> prop (type, disabled, onClick, …) passes through,
 * and `className` is appended LAST so callers can still override layout
 * details (flex-1, width, padding) without fighting the defaults.
 */

import type { ButtonHTMLAttributes } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";

export type ButtonVariant = "dark" | "light" | "surface" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  dark: "bg-black text-white",
  light: "bg-white text-black",
  surface: "border border-border-ui bg-surface text-white",
  danger: "bg-red-700 text-white",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconProp;
  iconPosition?: "left" | "right";
  iconSpin?: boolean;
  variant?: ButtonVariant;
}

export default function Button({
  icon,
  iconPosition = "left",
  iconSpin = false,
  variant = "dark",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2.5 rounded-4xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {icon && iconPosition === "left" && <FontAwesomeIcon icon={icon} spin={iconSpin} />}
      {children}
      {icon && iconPosition === "right" && <FontAwesomeIcon icon={icon} spin={iconSpin} />}
    </button>
  );
}
