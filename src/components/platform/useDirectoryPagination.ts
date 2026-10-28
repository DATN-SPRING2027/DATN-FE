"use client";

import { useState } from "react";

/** Paginate complete bounded inventories, never a partial server page. */
export default function useDirectoryPagination<T>(
  items: readonly T[],
  scope: string,
) {
  const pageSize = 10;
  const [selection, setSelection] = useState({ scope, page: 1 });
  const totalPages = Math.ceil(items.length / pageSize);
  const page = Math.min(
    selection.scope === scope ? selection.page : 1,
    Math.max(1, totalPages),
  );
  return {
    page,
    pageSize,
    totalPages,
    totalItems: items.length,
    rows: items.slice((page - 1) * pageSize, page * pageSize),
    onPageChange: (next: number) => setSelection({ scope, page: next }),
  };
}
