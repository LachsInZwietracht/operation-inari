"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface UseListUrlStateOptions {
  /** Parameter key → value used when the URL says nothing. */
  defaults: Record<string, string>;
}

/**
 * Keeps a list page's view, filters, grouping and sorting in the URL.
 *
 * State that lives only in React dies on a back-navigation and cannot be sent
 * to a colleague. A practitioner who narrows Aufnahmen down to "Fragebogen
 * zurück", opens someone and comes back must land on the same list — and being
 * able to paste that list into a message is worth as much as the filter itself.
 *
 * Values equal to their default are dropped from the URL, so the common case
 * stays a clean `/patienten/aufnahmen` rather than a wall of parameters.
 */
export function useListUrlState({ defaults }: UseListUrlStateOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useMemo(() => {
    const resolved: Record<string, string> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const fromUrl = searchParams.get(key);
      if (fromUrl) resolved[key] = fromUrl;
    }
    return resolved;
  }, [defaults, searchParams]);

  const write = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === defaults[key]) next.delete(key);
        else next.set(key, value);
      }

      const query = next.toString();
      // `replace` rather than `push`: filtering is refining one view, not
      // travelling. Otherwise Back would walk through every chip you clicked.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [defaults, pathname, router, searchParams],
  );

  const setValue = useCallback(
    (key: string, value: string) => write({ [key]: value }),
    [write],
  );

  const clearValue = useCallback((key: string) => write({ [key]: null }), [write]);

  return { values, setValue, clearValue, write };
}
