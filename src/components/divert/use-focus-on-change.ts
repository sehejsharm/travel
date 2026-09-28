"use client";

import { useEffect, useRef } from "react";

/**
 * When one screen swaps for another in place, start the new one at the top
 * with focus on its heading, the way a navigation would. The first value is
 * where the page loaded, so nothing moves then; null means not ready yet.
 */
export function useFocusOnChange(key: string | null): void {
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (key === null) return;

    const previous = last.current;
    last.current = key;
    if (previous === null || previous === key) return;

    window.scrollTo({ top: 0 });
    const heading = document.querySelector<HTMLElement>("main h1");
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [key]);
}
