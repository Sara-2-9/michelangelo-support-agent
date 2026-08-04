/**
 * Scrolls the referenced element into view whenever the dependencies
 * change — used to keep the latest chat message visible.
 */

import { useEffect, useRef } from "react";

export function useAutoScroll<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
    // The caller owns the dependency list (messages, loading, …).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
