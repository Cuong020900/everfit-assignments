export interface ApiMeta {
  timestamp: string; // ISO 8601 UTC
  requestId: string;
}

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/** Controller return type — interceptor will add `meta` field. */
export interface ApiResponse<T> {
  data: T;
}

/** Extend for single-resource service results. */
export interface ApiResult<T> {
  data: T;
}

/** Extend for paginated list service results. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
