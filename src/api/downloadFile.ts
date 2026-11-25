/**
 * `queryFn` body for a file download (PDFs): fetch `url` and save it as `fileName`.
 *
 * The Blob never reaches the RTK store (it is not serializable): the query's data is `null`.
 * Endpoints using it set `keepUnusedDataFor: 0`; callers re-run the lazy trigger per download.
 */
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { saveBlob } from '../utils/download';

type BaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export async function downloadFile(
  url: string,
  fileName: string,
  baseQuery: (arg: string | FetchArgs) => ReturnType<BaseQuery>
): Promise<{ data: null } | { error: FetchBaseQueryError }> {
  const result = await baseQuery({
    url,
    // An error body is the JSON envelope, so its message survives (and stays serializable)
    responseHandler: response => (response.ok ? response.blob() : response.json()),
  });
  if (result.error) return { error: result.error };
  saveBlob(result.data as Blob, fileName);
  return { data: null };
}
