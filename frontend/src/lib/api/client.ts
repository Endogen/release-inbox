export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }
}

type QueryValue = string | number | boolean | null | undefined

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
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value))
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
  delete: <T = void>(path: string, body?: unknown) => request<T>("DELETE", path, { body }),
}
