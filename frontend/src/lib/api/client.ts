export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

function failedWith(error: unknown, status: number): error is ApiError {
  return error instanceof ApiError && error.status === status
}

export const isUnauthorized = (error: unknown) => failedWith(error, 401)
export const isNotFound = (error: unknown) => failedWith(error, 404)
export const isConflict = (error: unknown) => failedWith(error, 409)

type QueryScalar = string | number | boolean
/** Arrays repeat the parameter (``?id=1&id=2``); empty values are left out. */
type QueryValue = QueryScalar | readonly QueryScalar[] | null | undefined

interface RequestOptions {
  query?: Record<string, QueryValue>
  body?: unknown
  signal?: AbortSignal
  /** Lets the request outlive the page, e.g. when it is sent while the tab closes. */
  keepalive?: boolean
}

async function request<T>(
  method: string,
  path: string,
  { query, body, signal, keepalive }: RequestOptions = {}
): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    method,
    signal,
    keepalive,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    const values: readonly QueryScalar[] = Array.isArray(value) ? value : [value ?? ""]
    for (const item of values) {
      if (item !== "") params.append(key, String(item))
    }
  }
  const search = params.toString()
  return `/api${path}${search ? `?${search}` : ""}`
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()
    if (payload && typeof payload === "object" && "detail" in payload) {
      const { detail } = payload
      if (typeof detail === "string") return detail
      // Validation errors (422) list one message per invalid field.
      if (Array.isArray(detail)) {
        const messages = detail.flatMap((item: unknown) =>
          item && typeof item === "object" && "msg" in item && typeof item.msg === "string"
            ? [item.msg]
            : []
        )
        if (messages.length > 0) return messages.join(". ")
      }
    }
  } catch {
    // Not a JSON error payload; fall back to the status text below.
  }
  return response.statusText || `Request failed with status ${response.status}`
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("GET", path, options),
  post: <T = void>(path: string, body?: unknown, options?: Pick<RequestOptions, "keepalive">) =>
    request<T>("POST", path, { body, ...options }),
  put: <T = void>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T = void>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T = void>(path: string, body?: unknown) => request<T>("DELETE", path, { body }),
}
