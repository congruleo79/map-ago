import { useState } from "react"

export const API_BASE_URL = "https://mapago-backend.map-ago.workers.dev"
export const SESSION_TOKEN_COOKIE = "mapago_session_token"
export const MAX_ROUND_SCORE = 100

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE"

export type ApiRequestOptions = {
  method?: RequestMethod
  body?: unknown
  token?: string | null
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export type BackendUser = {
  publicId: string
  handle: string
  displayName: string
  hasPassword: boolean
  createdAt: string
}

export type BackendLocation = {
  publicId: string
  ordinal: number
  name: string
  region: string
  isoCountryCode?: string
  description?: string
  latitude: number
  longitude: number
  locationLink?: string
  sourceLink?: string
  pageViews?: number
}

export type BackendGame = {
  game_id?: number
  public_id?: string
  publicId?: string
  game_date?: string
  gameDate?: string
  name: string
  locations: BackendLocation[]
}

export type BackendGuess = {
  publicId: string
  locationPublicId: string
  ordinal: number
  latitude: number
  longitude: number
  distanceMeters: number
  score: number
  createdAt?: string
}

export type BackendPlay = {
  publicId: string
  totalScore: number
  finalizedAt: string | null
  createdAt: string
  guesses: BackendGuess[]
}

export type SocialGuessEntry = {
  playPublicId: string
  totalScore: number
  finalizedAt: string | null
  user: Pick<BackendUser, "publicId" | "handle" | "displayName">
  guess: {
    publicId: string
    latitude: number
    longitude: number
    distanceMeters: number
    score: number
  }
}

export type SocialPlay = {
  playPublicId: string
  totalScore: number
  finalizedAt: string | null
  user: Pick<BackendUser, "publicId" | "handle" | "displayName">
  guesses: Array<{
    locationPublicId: string
    ordinal: number
    guessPublicId: string
    latitude: number
    longitude: number
    distanceMeters: number
    score: number
  }>
}

function trimCookieValue(value: string) {
  return value.replace(/^\s+|\s+$/g, "")
}

function getCookieSecurityAttributes() {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return "; Secure"
  }

  return ""
}

export function getSessionToken() {
  if (typeof document === "undefined") {
    return null
  }

  const cookie = document.cookie
    .split(";")
    .map(trimCookieValue)
    .find((entry) => entry.startsWith(`${SESSION_TOKEN_COOKIE}=`))

  if (!cookie) {
    return null
  }

  return decodeURIComponent(cookie.slice(SESSION_TOKEN_COOKIE.length + 1))
}

export function setSessionToken(token: string) {
  if (typeof document === "undefined") {
    return
  }

  const maxAgeSeconds = 60 * 60 * 24 * 30
  document.cookie = `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${getCookieSecurityAttributes()}`
}

export function clearSessionToken() {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = `${SESSION_TOKEN_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${getCookieSecurityAttributes()}`
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { method = "GET", body, signal } = options
  const token = options.token ?? getSessionToken()
  const headers = new Headers({
    Accept: "application/json",
  })

  if (body !== undefined) {
    headers.set("Content-Type", "application/json")
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  const isJson = response.headers.get("content-type")?.includes("application/json")
  const payload = isJson ? ((await response.json()) as Record<string, unknown>) : null

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}`
    throw new ApiError(message, response.status)
  }

  return payload as T
}

export async function ensureGuestSession() {
  const token = getSessionToken()

  if (token) {
    return token
  }

  const payload = await apiRequest<{ token: string; user: BackendUser }>("/sessions/guest", {
    method: "POST",
  })

  setSessionToken(payload.token)
  return payload.token
}

export async function withSession<T>(task: (token: string) => Promise<T>) {
  let token = await ensureGuestSession()

  try {
    return await task(token)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error
    }

    clearSessionToken()
    token = await ensureGuestSession()
    return task(token)
  }
}

export type RequestState<T> = {
  data: T
  isLoading: boolean
  error: string | null
}

function isAbortError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.name === "AbortError" || error.message.includes("aborted")
}

export function useRequestState<T>(initialData: T) {
  const [state, setState] = useState<RequestState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
  })

  async function run(task: () => Promise<T>) {
    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }))

    try {
      const data = await task()
      setState({ data, isLoading: false, error: null })
      return data
    } catch (error) {
      if (isAbortError(error)) {
        setState((current) => ({
          ...current,
          isLoading: false,
          error: null,
        }))
        throw error
      }

      const message = error instanceof Error ? error.message : "Unexpected error"
      setState((current) => ({
        ...current,
        isLoading: false,
        error: message,
      }))
      throw error
    }
  }

  function setData(data: T) {
    setState({ data, isLoading: false, error: null })
  }

  function setError(error: string | null) {
    setState((current) => ({
      ...current,
      error,
      isLoading: false,
    }))
  }

  return {
    ...state,
    run,
    setData,
    setError,
  }
}
