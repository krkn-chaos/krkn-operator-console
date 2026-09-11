import { useState, useMemo, useEffect } from 'react';

/**
 * usePagination hook
 *
 * Provides client-side pagination functionality with automatic reset
 * when filtered data changes.
 *
 * **Features:**
 * - Manages page and perPage state
 * - Calculates pagination metadata (totalPages, startIndex, endIndex)
 * - Slices data array based on current page
 * - Automatically resets to page 1 when data changes
 * - Provides handlers for page and perPage changes
 *
 * @template T - The type of items in the data array
 *
 * @param {T[]} data - The complete array of items to paginate
 * @param {Object} options - Pagination options
 * @param {number} [options.initialPerPage=10] - Initial items per page (default: 10)
 *
 * @returns {Object} Pagination state and handlers
 * @returns {number} page - Current page number (1-indexed)
 * @returns {number} perPage - Number of items per page
 * @returns {number} totalItems - Total number of items in the data array
 * @returns {number} totalPages - Total number of pages
 * @returns {T[]} paginatedData - Sliced array for the current page
 * @returns {function} setPage - Handler to change current page
 * @returns {function} setPerPage - Handler to change items per page
 * @returns {function} handleSetPage - PatternFly-compatible page change handler
 * @returns {function} handlePerPageSelect - PatternFly-compatible perPage change handler
 *
 * @example
 * ```typescript
 * import { usePagination } from '../hooks/usePagination';
 *
 * function MyList({ items }: { items: Item[] }) {
 *   const {
 *     paginatedData,
 *     page,
 *     perPage,
 *     totalItems,
 *     totalPages,
 *     handleSetPage,
 *     handlePerPageSelect,
 *   } = usePagination(items, { initialPerPage: 20 });
 *
 *   return (
 *     <>
 *       <DataList>
 *         {paginatedData.map(item => <DataListItem key={item.id}>...</DataListItem>)}
 *       </DataList>
 *       {totalPages > 1 && (
 *         <Pagination
 *           itemCount={totalItems}
 *           perPage={perPage}
 *           page={page}
 *           onSetPage={handleSetPage}
 *           onPerPageSelect={handlePerPageSelect}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function usePagination<T>(
  data: T[],
  options: {
    initialPerPage?: number;
  } = {}
) {
  const { initialPerPage = 10 } = options;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);

  // Reset to page 1 when data changes (e.g., after filtering/sorting)
  useEffect(() => {
    setPage(1);
  }, [data]);

  // Calculate pagination metadata and slice data
  const pagination = useMemo(() => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      paginatedData,
    };
  }, [data, page, perPage]);

  // PatternFly-compatible handlers
  const handleSetPage = (_evt: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handlePerPageSelect = (_evt: unknown, newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1); // Reset to page 1 when changing items per page
  };

  return {
    page,
    perPage,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    paginatedData: pagination.paginatedData,
    setPage,
    setPerPage,
    handleSetPage,
    handlePerPageSelect,
  };
}
