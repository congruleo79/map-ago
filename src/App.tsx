import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet"
import { divIcon } from "leaflet"
import type { DivIcon, LatLngLiteral, LeafletMouseEvent } from "leaflet"
import { GeodesicLine } from "leaflet.geodesic"
import "leaflet/dist/leaflet.css"
import "./App.css"
import {
  ApiError,
  MAX_ROUND_SCORE,
  apiRequest,
  setSessionToken,
  type BackendGame,
  type BackendPlay,
  type BackendUser,
  type SocialGuessEntry,
  type SocialPlay,
  useRequestState,
  withSession,
} from "./api"
import type { LocationTarget } from "./dailyChallenges"

type RoundResult = {
  ordinal: number
  target: LocationTarget
  guess: LatLngLiteral
  distanceKm: number
  points: number
  rawScore: number
}

type AppData = {
  game: BackendGame | null
  play: BackendPlay | null
  user: BackendUser | null
  socialByOrdinal: Record<number, SocialGuessEntry[]>
  socialPlays: SocialPlay[]
}

type FriendGuessMarker = {
  key: string
  label: string
  handle: string
  points: number
  distanceKm: number
  position: LatLngLiteral
  avatarLabel: string
  avatarColor: string
}

type RoundStandingRow = {
  rank: number
  key: string
  displayName: string
  distanceKm: number
  points: number
  isCurrentUser: boolean
  avatarLabel: string
  avatarColor: string
}

type MapGuessLine = {
  key: string
  color: string
  position: LatLngLiteral
  target: LatLngLiteral
  weight: number
}

type SummaryGuessMarker = {
  key: string
  label: string
  points: number
  distanceKm: number
  position: LatLngLiteral
  avatarLabel: string
  avatarColor: string
  target: LatLngLiteral
  targetName: string
  lineWeight: number
}

type PlayerTableRow = {
  playerKey: string
  displayName: string
  handle: string
  avatarLabel: string
  avatarColor: string
  totalScore: number
  totalPoints: number
  perRoundPoints: Array<number | null>
  isCurrentUser: boolean
}

type FollowedUser = {
  publicId: string
  handle: string
  displayName: string
  followedAt: string
}

const initialAppData: AppData = {
  game: null,
  play: null,
  user: null,
  socialByOrdinal: {},
  socialPlays: [],
}

const mapAttribution = "&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
const imageryTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const referenceOverlayTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
const defaultCenter: [number, number] = [18, 11]
const defaultZoom = 2
const worldOffsets = [-360, 0, 360]

function BaseMapLayers({ showReferenceOverlay = false }: { showReferenceOverlay?: boolean }) {
  return (
    <>
      <TileLayer attribution={mapAttribution} url={imageryTileUrl} />
      {showReferenceOverlay ? <TileLayer attribution={mapAttribution} opacity={0.9} url={referenceOverlayTileUrl} zIndex={400} /> : null}
    </>
  )
}

function createPinIcon(className: string, options?: { avatar?: { label: string; backgroundColor: string }; bodyColor?: string; innerColor?: string }): DivIcon {
  return divIcon({
    className: "map-pin-icon",
    html: `
      <span class="map-pin-shell">
        <svg class="${className}" width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">
          <path d="M15 1C8.373 1 3 6.373 3 13c0 9.728 9.252 18.472 11.321 26.427a.7.7 0 0 0 1.358 0C17.748 31.472 27 22.728 27 13 27 6.373 21.627 1 15 1Z" style="fill: ${options?.bodyColor ?? "#ffffff"}" />
          <circle cx="15" cy="13" r="5.25" style="fill: ${options?.innerColor ?? "#0f1012"}" />
        </svg>
        ${options?.avatar ? `<span class="map-pin__avatar" aria-hidden="true" style="background-color: ${options.avatar.backgroundColor}">${options.avatar.label}</span>` : ""}
      </span>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 41],
  })
}

function createTargetPinIcon(): DivIcon {
  return divIcon({
    className: "map-pin-icon",
    html: `
      <span class="map-pin-shell map-pin-shell--target">
        <svg class="map-pin map-pin--target" width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">
          <path d="M15 1C8.373 1 3 6.373 3 13c0 9.728 9.252 18.472 11.321 26.427a.7.7 0 0 0 1.358 0C17.748 31.472 27 22.728 27 13 27 6.373 21.627 1 15 1Z" style="fill: #ffffff" />
          <circle cx="15" cy="13" r="5.25" style="fill: #f3f4f6" />
        </svg>
        <span class="map-pin__emoji" aria-hidden="true">🎯</span>
      </span>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 41],
  })
}

function formatDistance(distanceKm: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: distanceKm >= 100 ? 0 : 1,
  }).format(distanceKm)
}

function getFlagEmoji(isoCountryCode?: string) {
  if (!isoCountryCode) {
    return ""
  }

  const normalizedCountryCode = isoCountryCode.trim().toUpperCase()

  if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
    return ""
  }

  return String.fromCodePoint(...normalizedCountryCode.split("").map((character) => 127397 + character.charCodeAt(0)))
}

function getRoundScoreColor(points: number) {
  const clampedPoints = Math.max(0, Math.min(100, points))
  const hue = (clampedPoints / 100) ** 2 * 120

  return `hsl(${hue} 72% 48%)`
}

function getShareSquares(points: number) {
  const clampedPoints = Math.max(0, Math.min(100, points))
  const greenCount = Math.floor(clampedPoints / 20)
  const yellowCount = clampedPoints < 100 && clampedPoints % 20 >= 10 ? 1 : 0
  const redCount = 5 - greenCount - yellowCount

  return `${"🟩".repeat(greenCount)}${"🟨".repeat(yellowCount)}${"🟥".repeat(redCount)}`
}

function formatShareDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

async function copyTextWithLegacyFallback(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the legacy copy path below.
    }
  }

  if (typeof document === "undefined") {
    return false
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.setAttribute("aria-hidden", "true")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "0"
  textarea.style.width = "1px"
  textarea.style.height = "1px"
  textarea.style.padding = "0"
  textarea.style.border = "0"
  textarea.style.opacity = "0"

  document.body.appendChild(textarea)

  const selection = document.getSelection()
  const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)

    if (selection) {
      selection.removeAllRanges()

      if (originalRange) {
        selection.addRange(originalRange)
      }
    }
  }
}

function getWikipediaLink(target: LocationTarget) {
  return target.link || target.source || ""
}

function wrapLongitudeNearReference(referenceLng: number, lng: number) {
  const candidates = [lng - 360, lng, lng + 360]

  return candidates.reduce((closest, candidate) => {
    return Math.abs(candidate - referenceLng) < Math.abs(closest - referenceLng) ? candidate : closest
  }, candidates[0])
}

function getWrappedTargetForDisplay(guess: LatLngLiteral | null, target: LatLngLiteral): LatLngLiteral {
  if (!guess) {
    return target
  }

  return {
    lat: target.lat,
    lng: wrapLongitudeNearReference(guess.lng, target.lng),
  }
}

function getWrappedCopies(position: LatLngLiteral) {
  return worldOffsets.map((offset) => ({
    lat: position.lat,
    lng: position.lng + offset,
  }))
}

function getWrappedGuessTargetPairs(guess: LatLngLiteral, target: LatLngLiteral) {
  return getWrappedCopies(guess).map((guessCopy) => ({
    guess: guessCopy,
    target: getWrappedTargetForDisplay(guessCopy, target),
  }))
}

function getGameDateKey(game: BackendGame) {
  return game.game_date ?? game.gameDate ?? ""
}

function getDisplayPoints(rawScore: number) {
  return Math.round((rawScore / MAX_ROUND_SCORE) * 100)
}

function getAvatarLabel(user: Pick<BackendUser, "handle" | "hasPassword">) {
  if (!user.hasPassword) {
    return "?"
  }

  const firstCharacter = user.handle.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : "?"
}

function getSeededAvatarColor(seed: string) {
  let hash = 0

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  const hue = hash % 360
  const saturation = 58 + (hash % 18)
  const lightness = 42 + (hash % 12)

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function getHandleAvatarLabel(handle: string) {
  const firstCharacter = handle.trim().charAt(0)
  return firstCharacter ? firstCharacter.toUpperCase() : "?"
}

function getReferralHandle() {
  if (typeof window === "undefined") {
    return null
  }

  const handle = new URL(window.location.href).searchParams.get("u")?.trim().toLowerCase()
  return handle || null
}

function getShareUrl(handle: string) {
  if (typeof window === "undefined") {
    return ""
  }

  const url = new URL(window.location.href)
  url.searchParams.set("u", handle)
  return url.toString()
}

function clearReferralHandleFromUrl() {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.delete("u")
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
}

function slugifyHandle(value: string) {
  const normalizedValue = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  return normalizedValue
}

function getAccountWarning(user: BackendUser) {
  if (user.hasPassword) {
    return null
  }

  return "This is a temporary guest account. If you leave without creating a password or logging in, your progress can be lost."
}

function mapLocation(location: BackendGame["locations"][number]): LocationTarget {
  return {
    name: location.name,
    region: location.region,
    isoCountryCode: location.isoCountryCode,
    text: location.description,
    link: location.sourceLink ?? location.locationLink,
    source: location.locationLink ?? location.sourceLink,
    views: location.pageViews,
    coordinates: {
      lat: location.latitude,
      lng: location.longitude,
    },
  }
}

function mapPlayToResults(play: BackendPlay | null, targets: LocationTarget[]) {
  if (!play) {
    return [] as RoundResult[]
  }

  return play.guesses
    .map((guess) => {
      const target = targets[guess.ordinal - 1]

      if (!target) {
        return null
      }

      return {
        ordinal: guess.ordinal,
        target,
        guess: {
          lat: guess.latitude,
          lng: guess.longitude,
        },
        distanceKm: guess.distanceMeters / 1000,
        points: getDisplayPoints(guess.score),
        rawScore: guess.score,
      }
    })
    .filter((result): result is RoundResult => result !== null)
    .sort((left, right) => left.ordinal - right.ordinal)
}

function createPlayerTableRow(play: BackendPlay, user: Pick<BackendUser, "publicId" | "handle" | "displayName">, roundCount: number, isCurrentUser: boolean): PlayerTableRow {
  const perRoundPoints = Array.from({ length: roundCount }, (_, index) => {
    const guess = play.guesses.find((entry) => entry.ordinal === index + 1)
    return guess ? getDisplayPoints(guess.score) : null
  })

  return {
    playerKey: user.publicId,
    displayName: user.displayName,
    handle: user.handle,
    avatarLabel: getHandleAvatarLabel(user.handle),
    avatarColor: getSeededAvatarColor(user.handle),
    totalScore: play.totalScore,
    totalPoints: Math.round((play.totalScore / (MAX_ROUND_SCORE * Math.max(roundCount, 1))) * roundCount * 100),
    perRoundPoints,
    isCurrentUser,
  }
}

function buildFriendGuessMarkers(guesses: SocialGuessEntry[]) {
  return guesses.map((entry) => ({
    key: entry.user.publicId,
    label: entry.user.displayName,
    handle: entry.user.handle,
    points: getDisplayPoints(entry.guess.score),
    distanceKm: entry.guess.distanceMeters / 1000,
    position: {
      lat: entry.guess.latitude,
      lng: entry.guess.longitude,
    },
    avatarLabel: getHandleAvatarLabel(entry.user.handle),
    avatarColor: getSeededAvatarColor(entry.user.handle),
  }))
}

function wrapPositionNearReference(referenceLng: number, position: LatLngLiteral): LatLngLiteral {
  return {
    lat: position.lat,
    lng: wrapLongitudeNearReference(referenceLng, position.lng),
  }
}

function LoadingCard({ message }: { message: string }) {
  return (
    <section className="overlay overlay--top" aria-label="Loading game">
      <div className="hud-card hud-card--top hud-card--status">
        <p className="eyebrow eyebrow--left">Loading</p>
        <div className="loading-indicator" aria-hidden="true">
          <span className="loading-indicator__spinner"></span>
        </div>
        <p>{message}</p>
      </div>
    </section>
  )
}

function UserPanel({
  createAccountError,
  createAccountHandle,
  createAccountPassword,
  follows,
  followsError,
  followsLoading,
  isGuest,
  loginError,
  loginHandle,
  loginLoading,
  loginPassword,
  onClose,
  onCreateAccountHandleChange,
  onCreateAccountPasswordChange,
  onCreatePassword,
  onLogin,
  onLoginHandleChange,
  onLoginPasswordChange,
  onUnfollow,
  unfollowingHandle,
  user,
  userAvatarColor,
  userAvatarLabel,
}: {
  createAccountError: string | null
  createAccountHandle: string
  createAccountPassword: string
  follows: FollowedUser[]
  followsError: string | null
  followsLoading: boolean
  isGuest: boolean
  loginError: string | null
  loginHandle: string
  loginLoading: boolean
  loginPassword: string
  onClose: () => void
  onCreateAccountHandleChange: (value: string) => void
  onCreateAccountPasswordChange: (value: string) => void
  onCreatePassword: () => void
  onLogin: () => void
  onLoginHandleChange: (value: string) => void
  onLoginPasswordChange: (value: string) => void
  onUnfollow: (handle: string) => void
  unfollowingHandle: string | null
  user: BackendUser
  userAvatarColor: string
  userAvatarLabel: string
}) {
  const warning = getAccountWarning(user)

  return (
    <section className="account-panel" aria-label="User account">
      <div className="account-panel__card">
        <div className="account-panel__header">
          <button type="button" className="account-panel__close" onClick={onClose} aria-label="Close user panel">
            Close
          </button>
        </div>

        <div className="account-panel__identity">
          <span className="account-panel__avatar" aria-hidden="true" style={{ backgroundColor: userAvatarColor }}>
            {userAvatarLabel}
          </span>
          <span className="account-panel__name">{user.displayName}</span>
          <strong className="account-panel__handle">@{user.handle}</strong>
        </div>

        {warning ? <p className="account-panel__warning">{warning}</p> : null}

        {isGuest ? (
          <>
            <div className="account-panel__section">
              <h3>Create password</h3>
              <p className="account-panel__copy">Keep your current progress by adding a password and optionally replacing the guest handle.</p>
              <label className="account-panel__field">
                <span>Name</span>
                <input value={createAccountHandle} onChange={(event) => onCreateAccountHandleChange(event.target.value)} autoComplete="name" />
              </label>
              <p className="account-panel__copy">Handle preview: {slugifyHandle(createAccountHandle) || "choose_a_name"}</p>
              <label className="account-panel__field">
                <span>Password</span>
                <input type="password" value={createAccountPassword} onChange={(event) => onCreateAccountPasswordChange(event.target.value)} autoComplete="new-password" />
              </label>
              {createAccountError ? <p className="account-panel__error">{createAccountError}</p> : null}
              <button type="button" className="button button--primary" onClick={onCreatePassword}>
                Create password
              </button>
            </div>

            <div className="account-panel__section">
              <h3>Login to existing account</h3>
              <label className="account-panel__field">
                <span>Handle</span>
                <input value={loginHandle} onChange={(event) => onLoginHandleChange(event.target.value)} autoComplete="username" />
              </label>
              <label className="account-panel__field">
                <span>Password</span>
                <input type="password" value={loginPassword} onChange={(event) => onLoginPasswordChange(event.target.value)} autoComplete="current-password" />
              </label>
              {loginError ? <p className="account-panel__error">{loginError}</p> : null}
              <button type="button" className="button button--ghost" onClick={onLogin} disabled={loginLoading}>
                {loginLoading ? "Logging in..." : "Login"}
              </button>
            </div>
          </>
        ) : null}

        <div className="account-panel__section">
          <h3>Following</h3>
          {followsLoading ? <p className="account-panel__copy">Loading followed players...</p> : null}
          {followsError ? <p className="account-panel__error">{followsError}</p> : null}
          {!followsLoading && !followsError && follows.length === 0 ? <p className="account-panel__copy">You are not following anyone yet.</p> : null}
          {!followsLoading && follows.length > 0 ? (
            <ul className="account-panel__list">
              {follows.map((followedUser) => (
                <li key={followedUser.publicId} className="account-panel__list-item">
                  <div className="account-panel__list-copy">
                    <span className="account-panel__list-name">{followedUser.displayName}</span>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost account-panel__list-action"
                    onClick={() => onUnfollow(followedUser.handle)}
                    disabled={followsLoading || unfollowingHandle === followedUser.handle}
                  >
                    {unfollowingHandle === followedUser.handle ? "Removing..." : "Unfollow"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function MapViewportController({
  guess,
  isMobileViewport,
  revealGuessPositions,
  revealTarget,
  roundIndex,
  target,
}: {
  guess: LatLngLiteral | null
  isMobileViewport: boolean
  revealGuessPositions: LatLngLiteral[]
  revealTarget: boolean
  roundIndex: number
  target: LatLngLiteral
}) {
  const map = useMap()

  useEffect(() => {
    if (roundIndex === 0 || revealTarget || guess) {
      return
    }

    map.setZoom(defaultZoom, {
      animate: true,
    })
  }, [guess, map, revealTarget, roundIndex])

  useEffect(() => {
    if (!guess || revealTarget) {
      return
    }

    map.panTo(guess, {
      animate: true,
      duration: 0.35,
    })
  }, [guess, map, revealTarget])

  useEffect(() => {
    if (!revealTarget || revealGuessPositions.length === 0) {
      return
    }

    const referenceGuess = revealGuessPositions[0] ?? guess

    if (!referenceGuess) {
      return
    }

    const wrappedTarget = getWrappedTargetForDisplay(referenceGuess, target)
    const wrappedRevealGuesses = revealGuessPositions.map((position) => wrapPositionNearReference(wrappedTarget.lng, position))
    const mapHeight = map.getSize().y
    const topPadding = isMobileViewport ? Math.max(Math.round(mapHeight * 0.42), 220) : 48
    const bottomPadding = isMobileViewport ? 32 : 48

    map.fitBounds(
      wrappedRevealGuesses.concat(wrappedTarget).map((position) => [position.lat, position.lng] as [number, number]),
      {
        animate: true,
        duration: 0.5,
        paddingTopLeft: [48, topPadding],
        paddingBottomRight: [48, bottomPadding],
        maxZoom: 6,
      },
    )
  }, [guess, isMobileViewport, map, revealGuessPositions, revealTarget, target])

  return null
}

function GeodesicConnection({ guesses, revealTarget, target }: { guesses: MapGuessLine[]; revealTarget: boolean; target: LatLngLiteral }) {
  const map = useMap()

  useEffect(() => {
    if (!revealTarget || guesses.length === 0) {
      return
    }

    const geodesics = guesses.flatMap((entry) => {
      const wrappedGuess = wrapPositionNearReference(entry.target.lng, entry.position)

      return getWrappedGuessTargetPairs(wrappedGuess, entry.target).map(({ guess: guessCopy, target: targetCopy }) => {
        return new GeodesicLine([guessCopy, targetCopy], {
          color: entry.color,
          opacity: 0.88,
          weight: entry.weight,
          steps: 6,
          wrap: false,
        }).addTo(map)
      })
    })

    return () => {
      geodesics.forEach((geodesic) => {
        map.removeLayer(geodesic)
      })
    }
  }, [guesses, map, revealTarget, target])

  return null
}

function SummaryMap({ guessMarkers }: { guessMarkers: SummaryGuessMarker[] }) {
  const map = useMap()
  const [activeGuessLabelKey, setActiveGuessLabelKey] = useState<string | null>(null)
  const guessLabelTimeoutRef = useRef<number | null>(null)

  const guessLines = useMemo(
    () =>
      guessMarkers.map((marker) => ({
        key: marker.key,
        color: marker.avatarColor,
        position: marker.position,
        target: marker.target,
        weight: marker.lineWeight,
      })),
    [guessMarkers],
  )

  const uniqueTargets = useMemo(() => {
    const seen = new Set<string>()

    return guessMarkers.filter((marker) => {
      const key = `${marker.targetName}-${marker.target.lat}-${marker.target.lng}`

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
  }, [guessMarkers])

  useEffect(() => {
    return () => {
      if (guessLabelTimeoutRef.current !== null) {
        window.clearTimeout(guessLabelTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (guessMarkers.length === 0) {
      return
    }

    const points = [...guessMarkers.map((marker) => marker.position), ...uniqueTargets.map((marker) => marker.target)]

    map.fitBounds(
      points.map((point) => [point.lat, point.lng] as [number, number]),
      {
        animate: true,
        duration: 0.45,
        paddingTopLeft: [48, 120],
        paddingBottomRight: [48, 48],
        maxZoom: 3,
      },
    )
  }, [guessMarkers, map, uniqueTargets])

  function showGuessLabel(labelKey: string) {
    if (guessLabelTimeoutRef.current !== null) {
      window.clearTimeout(guessLabelTimeoutRef.current)
    }

    setActiveGuessLabelKey(labelKey)
    guessLabelTimeoutRef.current = window.setTimeout(() => {
      setActiveGuessLabelKey(null)
      guessLabelTimeoutRef.current = null
    }, 3000)
  }

  useMapEvents({
    click() {
      setActiveGuessLabelKey(null)
    },
    mousedown() {
      setActiveGuessLabelKey(null)
    },
    dragstart() {
      setActiveGuessLabelKey(null)
    },
  })

  return (
    <>
      {guessMarkers.flatMap((marker) =>
        getWrappedCopies(wrapPositionNearReference(marker.target.lng, marker.position)).map((guessCopy, index) => {
          const markerKey = `${marker.key}-${index}`

          return (
            <Marker
              key={markerKey}
              position={guessCopy}
              icon={createPinIcon("map-pin map-pin--friend", {
                avatar: {
                  label: marker.avatarLabel,
                  backgroundColor: marker.avatarColor,
                },
                bodyColor: marker.avatarColor,
                innerColor: "rgba(15, 16, 18, 0.78)",
              })}
              eventHandlers={{
                click() {
                  showGuessLabel(markerKey)
                },
              }}
            >
              {activeGuessLabelKey === markerKey ? (
                <Tooltip direction="top" offset={[0, -28]} className="map-label map-label--friend" opacity={1} permanent>
                  <span className="map-label__stack">
                    <strong className="map-label__title">{marker.label}</strong>
                    <span className="map-label__meta">
                      {marker.points} pts · {formatDistance(marker.distanceKm)} km
                    </span>
                  </span>
                </Tooltip>
              ) : null}
            </Marker>
          )
        }),
      )}

      {uniqueTargets.map((marker) => (
        <Marker key={`target-${marker.targetName}`} position={marker.target} icon={createTargetPinIcon()}>
          <Tooltip direction="top" offset={[0, -28]} className="map-label map-label--target" opacity={1} permanent>
            <span className="map-label__stack">
              <strong className="map-label__title">{marker.targetName}</strong>
            </span>
          </Tooltip>
        </Marker>
      ))}

      <GeodesicConnection guesses={guessLines} revealTarget={true} target={defaultCenter as unknown as LatLngLiteral} />
    </>
  )
}

function GameMap({
  currentUserAvatarColor,
  currentUserAvatarLabel,
  currentUserDistanceKm,
  currentUserName,
  currentUserPoints,
  friendGuesses,
  guess,
  isMobileViewport,
  onMapInteract,
  onGuess,
  revealTarget,
  roundIndex,
  target,
}: {
  currentUserAvatarColor: string
  currentUserAvatarLabel: string
  currentUserDistanceKm: number | null
  currentUserName: string
  currentUserPoints: number | null
  friendGuesses: FriendGuessMarker[]
  guess: LatLngLiteral | null
  isMobileViewport: boolean
  onMapInteract: () => void
  onGuess: (nextGuess: LatLngLiteral) => void
  revealTarget: boolean
  roundIndex: number
  target: LatLngLiteral
}) {
  const map = useMap()
  const [activeGuessLabelKey, setActiveGuessLabelKey] = useState<string | null>(null)
  const guessLabelTimeoutRef = useRef<number | null>(null)
  const displayedTarget = revealTarget ? getWrappedTargetForDisplay(guess, target) : target
  const currentGuessPinIcon = useMemo(
    () =>
      createPinIcon("map-pin map-pin--guess", {
        avatar: { label: currentUserAvatarLabel, backgroundColor: currentUserAvatarColor },
        bodyColor: currentUserAvatarColor,
        innerColor: "rgba(15, 16, 18, 0.78)",
      }),
    [currentUserAvatarColor, currentUserAvatarLabel],
  )
  const guessCopies = guess ? getWrappedCopies(guess) : []
  const targetCopies = revealTarget ? getWrappedCopies(displayedTarget) : []
  const revealGuessPositions = useMemo(
    () => (revealTarget ? [guess, ...friendGuesses.map((friendGuess) => friendGuess.position)].filter((position): position is LatLngLiteral => position !== null) : []),
    [friendGuesses, guess, revealTarget],
  )
  const guessLines = useMemo(() => {
    const lines = [] as MapGuessLine[]

    if (guess) {
      lines.push({
        key: "current-user",
        color: currentUserAvatarColor,
        position: guess,
        target: displayedTarget,
        weight: 5,
      })
    }

    lines.push(
      ...friendGuesses.map((friendGuess) => ({
        key: friendGuess.key,
        color: friendGuess.avatarColor,
        position: friendGuess.position,
        target: displayedTarget,
        weight: 3,
      })),
    )

    return lines
  }, [currentUserAvatarColor, friendGuesses, guess])

  useEffect(() => {
    return () => {
      if (guessLabelTimeoutRef.current !== null) {
        window.clearTimeout(guessLabelTimeoutRef.current)
      }
    }
  }, [])

  function showGuessLabel(labelKey: string) {
    if (guessLabelTimeoutRef.current !== null) {
      window.clearTimeout(guessLabelTimeoutRef.current)
    }

    setActiveGuessLabelKey(labelKey)
    guessLabelTimeoutRef.current = window.setTimeout(() => {
      setActiveGuessLabelKey(null)
      guessLabelTimeoutRef.current = null
    }, 3000)
  }

  useEffect(() => {
    const container = map.getContainer()

    const handleTouchStart = () => {
      onMapInteract()
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: true })

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
    }
  }, [map, onMapInteract])

  useMapEvents({
    mousedown() {
      onMapInteract()
    },
    dragstart() {
      onMapInteract()
    },
    click(event: LeafletMouseEvent) {
      onMapInteract()
      onGuess(event.latlng)
    },
  })

  return (
    <>
      <MapViewportController guess={guess} isMobileViewport={isMobileViewport} revealGuessPositions={revealGuessPositions} revealTarget={revealTarget} roundIndex={roundIndex} target={target} />
      {guessCopies.map((guessCopy, index) => {
        const markerKey = `guess-${index}`

        return (
          <Marker
            key={`guess-${guessCopy.lng}`}
            position={guessCopy}
            icon={currentGuessPinIcon}
            eventHandlers={{
              click() {
                showGuessLabel(markerKey)
              },
            }}
          >
            {activeGuessLabelKey === markerKey && currentUserPoints !== null && currentUserDistanceKm !== null ? (
              <Tooltip direction="top" offset={[0, -28]} className="map-label map-label--friend" opacity={1} permanent>
                <span className="map-label__stack">
                  <strong className="map-label__title">{currentUserName}</strong>
                  <span className="map-label__meta">
                    {currentUserPoints} pts · {formatDistance(currentUserDistanceKm)} km
                  </span>
                </span>
              </Tooltip>
            ) : null}
          </Marker>
        )
      })}

      {revealTarget
        ? friendGuesses.flatMap((friendGuess) =>
            getWrappedCopies(wrapPositionNearReference(displayedTarget.lng, friendGuess.position)).map((guessCopy, index) => (
              <Marker
                key={`${friendGuess.key}-${index}`}
                position={guessCopy}
                icon={createPinIcon("map-pin map-pin--friend", {
                  avatar: {
                    label: friendGuess.avatarLabel,
                    backgroundColor: friendGuess.avatarColor,
                  },
                  bodyColor: friendGuess.avatarColor,
                  innerColor: "rgba(15, 16, 18, 0.78)",
                })}
                title={`${friendGuess.label}: ${friendGuess.points} pts`}
                eventHandlers={{
                  click() {
                    showGuessLabel(`${friendGuess.key}-${index}`)
                  },
                }}
              >
                {activeGuessLabelKey === `${friendGuess.key}-${index}` ? (
                  <Tooltip direction="top" offset={[0, -28]} className="map-label map-label--friend" opacity={1} permanent>
                    <span className="map-label__stack">
                      <strong className="map-label__title">{friendGuess.label}</strong>
                      <span className="map-label__meta">
                        {friendGuess.points} pts · {formatDistance(friendGuess.distanceKm)} km
                      </span>
                    </span>
                  </Tooltip>
                ) : null}
              </Marker>
            )),
          )
        : null}

      {revealTarget ? (
        <>
          {targetCopies.map((targetCopy, index) => (
            <Marker key={`target-${targetCopy.lng}`} position={targetCopy} icon={index === 1 ? createTargetPinIcon() : createTargetPinIcon()} />
          ))}
          <GeodesicConnection guesses={guessLines} revealTarget={revealTarget} target={displayedTarget} />
        </>
      ) : null}
    </>
  )
}

function App() {
  const appState = useRequestState<AppData>(initialAppData)
  const actionState = useRequestState<null>(null)
  const followsState = useRequestState<FollowedUser[]>([])
  const loginState = useRequestState<null>(null)
  const createPasswordState = useRequestState<null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [guess, setGuess] = useState<LatLngLiteral | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [hasInteractedWithMap, setHasInteractedWithMap] = useState(false)
  const [isChallengeTextExpanded, setIsChallengeTextExpanded] = useState(true)
  const [showFinalResults, setShowFinalResults] = useState(false)
  const [showSummaryMap, setShowSummaryMap] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [isUserPanelOpen, setIsUserPanelOpen] = useState(false)
  const [createAccountHandle, setCreateAccountHandle] = useState("")
  const [createAccountPassword, setCreateAccountPassword] = useState("")
  const [loginHandle, setLoginHandle] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [hasBootstrapped, setHasBootstrapped] = useState(false)
  const [unfollowingHandle, setUnfollowingHandle] = useState<string | null>(null)
  const [isRoundStandingsCollapsed, setIsRoundStandingsCollapsed] = useState(false)
  const appDataRef = useRef<AppData>(initialAppData)
  const hydratedPlayRef = useRef(false)
  const handledReferralRef = useRef<string | null>(null)
  const previousPlaySnapshotRef = useRef<{ publicId: string | null; guessCount: number }>({
    publicId: null,
    guessCount: 0,
  })

  useEffect(() => {
    appDataRef.current = appState.data
  }, [appState.data])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)")

    const updateViewportMode = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    updateViewportMode()
    mediaQuery.addEventListener("change", updateViewportMode)

    return () => {
      mediaQuery.removeEventListener("change", updateViewportMode)
    }
  }, [])

  useEffect(() => {
    const nextUser = appState.data.user

    if (!nextUser) {
      return
    }

    setCreateAccountHandle(nextUser.displayName)
  }, [appState.data.user])

  async function fetchAppData(signal?: AbortSignal) {
    return withSession(async (token) => {
      const gameResponse = await apiRequest<{ game: BackendGame | null; user: BackendUser }>("/games/today", {
        token,
        signal,
      })

      if (!gameResponse.game) {
        return {
          game: null,
          play: null,
          user: gameResponse.user,
          socialByOrdinal: {},
          socialPlays: [],
        }
      }

      const playResponse = await apiRequest<{ play: BackendPlay }>("/games/today/play", {
        token,
        signal,
      })

      const guessedOrdinals = [...new Set(playResponse.play.guesses.map((entry) => entry.ordinal))]
      const socialByOrdinalEntries = await Promise.all(
        guessedOrdinals.map(async (ordinal) => {
          try {
            const socialResponse = await apiRequest<{ guesses: SocialGuessEntry[] }>(`/games/today/social/${ordinal}`, {
              token,
              signal,
            })

            return [ordinal, socialResponse.guesses] as const
          } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
              return [ordinal, []] as const
            }

            throw error
          }
        }),
      )

      let socialPlays: SocialPlay[] = []

      if (playResponse.play.guesses.length > 0) {
        try {
          const socialResponse = await apiRequest<{ plays: SocialPlay[] }>("/games/today/social", {
            token,
            signal,
          })
          socialPlays = socialResponse.plays
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 403)) {
            throw error
          }
        }
      }

      return {
        game: gameResponse.game,
        play: playResponse.play,
        user: gameResponse.user,
        socialByOrdinal: Object.fromEntries(socialByOrdinalEntries),
        socialPlays,
      }
    })
  }

  useEffect(() => {
    const abortController = new AbortController()

    void appState
      .run(() => fetchAppData(abortController.signal))
      .catch(() => undefined)
      .finally(() => {
        setHasBootstrapped(true)
      })

    return () => {
      abortController.abort()
    }
  }, [])

  const game = appState.data.game
  const play = appState.data.play
  const user = appState.data.user
  const targets = useMemo(() => game?.locations.map(mapLocation) ?? [], [game])
  const results = useMemo(() => mapPlayToResults(play, targets), [play, targets])
  const currentTarget = targets[roundIndex]
  const currentRoundOrdinal = roundIndex + 1
  const currentRoundResult = results.find((result) => result.ordinal === currentRoundOrdinal) ?? null
  const currentRoundGuess = currentRoundResult?.guess ?? guess
  const isRoundResolved = Boolean(currentRoundResult)
  const isAllRoundsScored = targets.length > 0 && results.length === targets.length
  const isFinished = isAllRoundsScored && showFinalResults
  const isShowingSummaryMap = isFinished && (showSummaryMap || !isMobileViewport)
  const currentRound = Math.min(roundIndex + 1, Math.max(targets.length, 1))
  const maxPoints = targets.length * 100
  const totalPoints = useMemo(() => results.reduce((sum, result) => sum + result.points, 0), [results])
  const isChallengeCollapsed = isMobileViewport && hasInteractedWithMap && !isChallengeTextExpanded && !isRoundResolved
  const shareDate = useMemo(() => (game ? formatShareDate(getGameDateKey(game)) : ""), [game])
  const challengeHeaderLabel = game?.name ?? shareDate
  const activeError = actionState.error ?? appState.error
  const currentRoundSocialGuesses = appState.data.socialByOrdinal[currentRoundOrdinal] ?? []
  const friendGuesses = buildFriendGuessMarkers(currentRoundSocialGuesses)
  const userAvatarLabel = user ? getAvatarLabel(user) : "?"
  const userAvatarColor = getSeededAvatarColor(user?.handle ?? "guest")
  const isGuestUser = Boolean(user && !user.hasPassword)
  const currentRoundStandings = useMemo(() => {
    if (!currentRoundResult || !user) {
      return [] as RoundStandingRow[]
    }

    const rows = [
      {
        key: user.publicId,
        displayName: user.displayName,
        distanceKm: currentRoundResult.distanceKm,
        points: currentRoundResult.points,
        isCurrentUser: true,
        avatarLabel: userAvatarLabel,
        avatarColor: userAvatarColor,
      },
      ...currentRoundSocialGuesses.map((entry) => ({
        key: entry.user.publicId,
        displayName: entry.user.displayName,
        distanceKm: entry.guess.distanceMeters / 1000,
        points: getDisplayPoints(entry.guess.score),
        isCurrentUser: false,
        avatarLabel: getHandleAvatarLabel(entry.user.handle),
        avatarColor: getSeededAvatarColor(entry.user.handle),
      })),
    ]

    return rows
      .sort((left, right) => {
        if (right.points !== left.points) {
          return right.points - left.points
        }

        if (left.distanceKm !== right.distanceKm) {
          return left.distanceKm - right.distanceKm
        }

        return left.displayName.localeCompare(right.displayName)
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      }))
  }, [currentRoundResult, currentRoundSocialGuesses, user, userAvatarColor, userAvatarLabel])

  useEffect(() => {
    if (isRoundResolved) {
      setIsRoundStandingsCollapsed(false)
    }
  }, [currentRoundOrdinal, isRoundResolved])

  useEffect(() => {
    if (!game || !play) {
      return
    }

    const guessedCount = play.guesses.length
    const lastIndex = Math.max(game.locations.length - 1, 0)
    const isInitialPlaySync = !hydratedPlayRef.current
    const isDifferentPlay = previousPlaySnapshotRef.current.publicId !== play.publicId

    if (isInitialPlaySync || isDifferentPlay) {
      setRoundIndex(play.finalizedAt ? lastIndex : Math.min(guessedCount, lastIndex))
      setShowFinalResults(Boolean(play.finalizedAt))
      hydratedPlayRef.current = true
    } else {
      setShowFinalResults(false)
    }

    previousPlaySnapshotRef.current = {
      publicId: play.publicId,
      guessCount: guessedCount,
    }
  }, [game, play])

  useEffect(() => {
    if (!isUserPanelOpen || !user) {
      return
    }

    void followsState
      .run(() =>
        withSession((token) =>
          apiRequest<{ users: FollowedUser[] }>("/follows", {
            token,
          }).then((payload) => payload.users),
        ),
      )
      .catch(() => undefined)
  }, [isUserPanelOpen, user])

  async function refreshFollows() {
    return followsState.run(() =>
      withSession((token) =>
        apiRequest<{ users: FollowedUser[] }>("/follows", {
          token,
        }).then((payload) => payload.users),
      ),
    )
  }

  useEffect(() => {
    if (!hasBootstrapped || !user) {
      return
    }

    const referralHandle = getReferralHandle()

    if (!referralHandle || handledReferralRef.current === referralHandle) {
      return
    }

    handledReferralRef.current = referralHandle

    if (referralHandle === user.handle.toLowerCase()) {
      clearReferralHandleFromUrl()
      return
    }

    void withSession(async (token) => {
      await apiRequest<{ follow: { publicId: string; followedUserId: string } }>(`/follows/${referralHandle}`, {
        method: "POST",
        token,
      })

      clearReferralHandleFromUrl()
    }).catch(() => undefined)
  }, [hasBootstrapped, user])

  const leaderboardRows = useMemo(() => {
    if (!play || !user || targets.length === 0) {
      return [] as PlayerTableRow[]
    }

    const rows = [
      createPlayerTableRow(play, user, targets.length, true),
      ...appState.data.socialPlays.map((socialPlay) =>
        createPlayerTableRow(
          {
            publicId: socialPlay.playPublicId,
            totalScore: socialPlay.totalScore,
            finalizedAt: socialPlay.finalizedAt,
            createdAt: socialPlay.finalizedAt ?? "",
            guesses: socialPlay.guesses.map((entry) => ({
              publicId: entry.guessPublicId,
              locationPublicId: entry.locationPublicId,
              ordinal: entry.ordinal,
              latitude: entry.latitude,
              longitude: entry.longitude,
              distanceMeters: entry.distanceMeters,
              score: entry.score,
            })),
          },
          {
            publicId: socialPlay.user.publicId,
            handle: socialPlay.user.handle,
            displayName: socialPlay.user.displayName,
          },
          targets.length,
          false,
        ),
      ),
    ]

    return rows.sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore
      }

      return left.displayName.localeCompare(right.displayName)
    })
  }, [appState.data.socialPlays, play, targets.length, user])
  const leaderboardRoundLeaders = useMemo(
    () =>
      Array.from({ length: targets.length }, (_, index) => {
        const roundPoints = leaderboardRows.map((row) => row.perRoundPoints[index]).filter((points): points is number => points !== null)

        return roundPoints.length > 0 ? Math.max(...roundPoints) : null
      }),
    [leaderboardRows, targets.length],
  )
  const summaryGuessMarkers = useMemo(() => {
    if (!user) {
      return [] as SummaryGuessMarker[]
    }

    const currentUserMarkers = results.map((result) => ({
      key: `current-${result.ordinal}`,
      label: user.displayName,
      points: result.points,
      distanceKm: result.distanceKm,
      position: result.guess,
      avatarLabel: userAvatarLabel,
      avatarColor: userAvatarColor,
      target: result.target.coordinates,
      targetName: result.target.name,
      lineWeight: 5,
    }))

    const socialMarkers = appState.data.socialPlays.flatMap((socialPlay) =>
      socialPlay.guesses
        .map((entry) => {
          const target = targets[entry.ordinal - 1]

          if (!target) {
            return null
          }

          return {
            key: `${socialPlay.user.publicId}-${entry.ordinal}`,
            label: socialPlay.user.displayName,
            points: getDisplayPoints(entry.score),
            distanceKm: entry.distanceMeters / 1000,
            position: {
              lat: entry.latitude,
              lng: entry.longitude,
            },
            avatarLabel: getHandleAvatarLabel(socialPlay.user.handle),
            avatarColor: getSeededAvatarColor(socialPlay.user.handle),
            target: target.coordinates,
            targetName: target.name,
            lineWeight: 3,
          }
        })
        .filter((marker): marker is SummaryGuessMarker => marker !== null),
    )

    return [...currentUserMarkers, ...socialMarkers]
  }, [appState.data.socialPlays, results, targets, user, userAvatarColor, userAvatarLabel])

  const shareText = useMemo(() => {
    const perRound = results
      .map((result) => {
        const flag = getFlagEmoji(result.target.isoCountryCode)
        const flagPrefix = flag ? `${flag} ` : ""

        return `${getShareSquares(result.points)} ${flagPrefix}${result.points}% (${formatDistance(result.distanceKm)} km)`
      })
      .join("\n")

    return `MapAgo ${shareDate}\n${perRound}\nCan you beat *${totalPoints} Points*?\n`
  }, [results, shareDate, totalPoints])

  async function submitGuess() {
    if (!guess || !game || !play || isRoundResolved || actionState.isLoading) {
      return
    }

    setShareMessage(null)
    setIsChallengeTextExpanded(true)

    await actionState
      .run(async () => {
        const guessResponse = await withSession((token) =>
          apiRequest<{ finalized: boolean; play: BackendPlay }>(`/games/today/guesses/${currentRoundOrdinal}`, {
            method: "POST",
            token,
            body: {
              latitude: guess.lat,
              longitude: guess.lng,
            },
          }),
        )

        let roundSocialGuesses: SocialGuessEntry[] = []

        try {
          const socialResponse = await withSession((token) =>
            apiRequest<{ guesses: SocialGuessEntry[] }>(`/games/today/social/${currentRoundOrdinal}`, {
              token,
            }),
          )
          roundSocialGuesses = socialResponse.guesses
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 403)) {
            throw error
          }
        }

        let socialPlays = appDataRef.current.socialPlays

        if (guessResponse.play.guesses.length > 0) {
          try {
            const socialResponse = await withSession((token) =>
              apiRequest<{ plays: SocialPlay[] }>("/games/today/social", {
                token,
              }),
            )
            socialPlays = socialResponse.plays
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 403)) {
              throw error
            }
          }
        }

        appState.setData({
          ...appDataRef.current,
          play: guessResponse.play,
          socialByOrdinal: {
            ...appDataRef.current.socialByOrdinal,
            [currentRoundOrdinal]: roundSocialGuesses,
          },
          socialPlays,
        })

        setGuess(null)
        setShowFinalResults(false)
        setShowSummaryMap(false)

        return null
      })
      .catch(() => undefined)
  }

  function goToNextRound() {
    if (!isRoundResolved || targets.length === 0) {
      return
    }

    setRoundIndex((previous) => Math.min(previous + 1, targets.length - 1))
    setGuess(null)
    setHasInteractedWithMap(false)
    setIsChallengeTextExpanded(true)
    setShareMessage(null)
    setShowSummaryMap(false)
  }

  function openFinalResults() {
    if (!isAllRoundsScored) {
      return
    }

    setShowFinalResults(true)
    setShareMessage(null)
    setShowSummaryMap(false)
  }

  async function shareScore() {
    const shareUrl = user ? getShareUrl(user.handle) : typeof window === "undefined" ? "" : window.location.href
    const sharePayload = shareText + "\n" + shareUrl

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "MapAgo score",
          text: shareText,
          url: shareUrl,
        })
        setShareMessage("Score shared.")
        return
      }
    } catch {
      // Fall through to clipboard-based fallbacks.
    }

    const copied = await copyTextWithLegacyFallback(sharePayload)

    if (copied) {
      setShareMessage("Score copied to clipboard.")
      return
    }

    setShareMessage("Sharing and copy both failed.")
  }

  async function createPassword() {
    if (!user) {
      return
    }

    const nextHandle = slugifyHandle(createAccountHandle)

    await createPasswordState
      .run(async () => {
        await withSession((token) =>
          apiRequest<{ user: BackendUser }>("/me", {
            method: "PATCH",
            token,
            body: {
              ...(nextHandle && nextHandle !== user.handle ? { handle: nextHandle } : {}),
              ...(createAccountHandle.trim() && createAccountHandle.trim() !== user.displayName ? { displayName: createAccountHandle.trim() } : {}),
              password: createAccountPassword,
            },
          }),
        )

        await appState.run(() => fetchAppData())
        setCreateAccountPassword("")
        setIsUserPanelOpen(false)
        return null
      })
      .catch(() => undefined)
  }

  async function loginToExistingAccount() {
    await loginState
      .run(async () => {
        const payload = await apiRequest<{ token: string; user: BackendUser }>("/sessions/login", {
          method: "POST",
          body: {
            handle: loginHandle,
            password: loginPassword,
          },
        })

        setSessionToken(payload.token)
        await appState.run(() => fetchAppData())
        setLoginPassword("")
        setIsUserPanelOpen(false)
        return null
      })
      .catch(() => undefined)
  }

  async function unfollowUser(handle: string) {
    setUnfollowingHandle(handle)

    await withSession((token) =>
      apiRequest(`/follows/${handle}`, {
        method: "DELETE",
        token,
      }),
    )
      .then(() => refreshFollows())
      .catch(() => undefined)
      .finally(() => {
        setUnfollowingHandle(null)
      })
  }

  if (!hasBootstrapped || (appState.isLoading && !game)) {
    return (
      <main className="game-shell">
        <MapContainer center={defaultCenter} className="game-map" worldCopyJump zoom={defaultZoom} zoomControl={false} minZoom={2} maxZoom={7}>
          <BaseMapLayers />
        </MapContainer>
        <LoadingCard message="Loading today’s game and your player session..." />
      </main>
    )
  }

  if (!game || !play || !user) {
    const isUnavailableState = !appState.isLoading && !activeError && !game && Boolean(user)

    if (!isUnavailableState && !activeError) {
      return (
        <main className="game-shell">
          <MapContainer center={defaultCenter} className="game-map" worldCopyJump zoom={defaultZoom} zoomControl={false} minZoom={2} maxZoom={7}>
            <BaseMapLayers />
          </MapContainer>
          <LoadingCard message="Loading today’s game and your player session..." />
        </main>
      )
    }

    return (
      <main className="game-shell">
        <MapContainer center={defaultCenter} className="game-map" worldCopyJump zoom={defaultZoom} zoomControl={false} minZoom={2} maxZoom={7}>
          <BaseMapLayers />
        </MapContainer>
        <section className="overlay overlay--top" aria-label="Game status">
          <div className="hud-card hud-card--top hud-card--status">
            <p className="eyebrow eyebrow--left">MapAgo</p>
            <h2>Today’s game is not available yet.</h2>
            <p>{activeError ?? "The backend returned no game for today."}</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="game-shell">
      <MapContainer center={defaultCenter} className="game-map" worldCopyJump zoom={defaultZoom} zoomControl={false} minZoom={2} maxZoom={7}>
        <BaseMapLayers showReferenceOverlay={isRoundResolved || isShowingSummaryMap} />
        {!isFinished && currentTarget ? (
          <GameMap
            currentUserAvatarColor={userAvatarColor}
            currentUserAvatarLabel={userAvatarLabel}
            currentUserDistanceKm={currentRoundResult?.distanceKm ?? null}
            currentUserName={user.displayName}
            currentUserPoints={currentRoundResult?.points ?? null}
            friendGuesses={friendGuesses}
            guess={currentRoundGuess}
            isMobileViewport={isMobileViewport}
            onMapInteract={() => {
              if (isRoundResolved) {
                setIsRoundStandingsCollapsed(true)
              }

              if (isMobileViewport) {
                setHasInteractedWithMap(true)
                setIsChallengeTextExpanded(false)
              }
            }}
            revealTarget={isRoundResolved}
            roundIndex={roundIndex}
            target={currentTarget.coordinates}
            onGuess={(nextGuess) => {
              if (!isRoundResolved) {
                setGuess(nextGuess)
              }
            }}
          />
        ) : isShowingSummaryMap ? (
          <SummaryMap guessMarkers={summaryGuessMarkers} />
        ) : null}
      </MapContainer>

      {isFinished && showSummaryMap && isMobileViewport ? (
        <section className="overlay overlay--top overlay--summary-map" aria-label="Summary map controls">
          <div className="summary-map-toolbar">
            <button type="button" className="button button--primary summary-map-toolbar__back" onClick={() => setShowSummaryMap(false)}>
              <span className="summary-map-toolbar__caret" aria-hidden="true" />
              <span>Back to Summary</span>
            </button>
          </div>
        </section>
      ) : null}

      {!isFinished ? (
        <section className="overlay overlay--top" aria-label="Round information">
          <div className="hud-card hud-card--top">
            <div className="panel-header">
              <p className="eyebrow eyebrow--left">{challengeHeaderLabel}</p>
              <div className="player-badge" aria-label={`Current player ${user.handle}`}>
                <button type="button" className="player-badge__button" onClick={() => setIsUserPanelOpen((current) => !current)}>
                  <span className="player-badge__handle">{user.handle}</span>
                  <span className="player-badge__avatar" aria-hidden="true" style={{ backgroundColor: userAvatarColor }}>
                    {userAvatarLabel}
                  </span>
                </button>
              </div>
            </div>
            <div className="round-status-row" aria-label={`Progress: round ${currentRound} of ${targets.length}`}>
              <div className="round-indicators">
                {targets.map((target, index) => {
                  const roundResult = results[index]
                  const isCurrentRound = index === roundIndex

                  return (
                    <span
                      key={target.name}
                      className={isCurrentRound ? "round-indicator round-indicator--current" : "round-indicator"}
                      style={roundResult ? { backgroundColor: getRoundScoreColor(roundResult.points) } : undefined}
                      aria-label={roundResult ? `Round ${index + 1}: ${roundResult.points} points` : isCurrentRound ? `Round ${index + 1}: current round` : `Round ${index + 1}: not played`}
                      title={roundResult ? `Round ${index + 1}: ${roundResult.points} points` : isCurrentRound ? `Round ${index + 1}: current round` : `Round ${index + 1}: not played`}
                    ></span>
                  )
                })}
              </div>
              <div className="round-status-copy">
                <span className="round-status-copy__score" aria-label={`Score ${totalPoints} points`}>
                  {totalPoints} PTS
                </span>
              </div>
            </div>
            <div
              className={isChallengeCollapsed ? "challenge-panel challenge-panel--collapsed" : "challenge-panel challenge-panel--expanded"}
              onClick={() => {
                if (isChallengeCollapsed) {
                  setIsChallengeTextExpanded(true)
                }
              }}
              onKeyDown={(event) => {
                if (isChallengeCollapsed && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault()
                  setIsChallengeTextExpanded(true)
                }
              }}
              role={isChallengeCollapsed ? "button" : undefined}
              tabIndex={isChallengeCollapsed ? 0 : undefined}
            >
              {!isRoundResolved ? (
                <>
                  <p className="challenge-kicker">Find on the map:</p>
                  <h1 className={isChallengeCollapsed ? "challenge-title challenge-title--collapsed" : "challenge-title"}>
                    <span>
                      {currentTarget.name}, {currentTarget.region}
                      {currentTarget.isoCountryCode ? (
                        <span className="challenge-region-flag" aria-label={currentTarget.region} title={currentTarget.region}>
                          {getFlagEmoji(currentTarget.isoCountryCode)}
                        </span>
                      ) : null}
                    </span>
                  </h1>
                </>
              ) : null}
              {currentTarget.text && !isRoundResolved ? (
                <div className={isChallengeCollapsed ? "challenge-text challenge-text--collapsed" : "challenge-text challenge-text--expanded"}>
                  <span className="challenge-text__content">{currentTarget.text}</span>
                </div>
              ) : null}
            </div>

            {activeError ? <p className="error-banner">{activeError}</p> : null}

            {guess || isRoundResolved ? (
              <div className="top-card-status">
                {isRoundResolved ? (
                  <>
                    <div className="control-copy">
                      <h2>
                        {currentRoundResult ? <span className="round-points">{currentRoundResult.points} Points</span> : "Round scored"}
                        {currentRoundResult ? <span className="round-distance">{` ${formatDistance(currentRoundResult.distanceKm)} km away`}</span> : null}
                      </h2>
                      <div className={isRoundStandingsCollapsed ? "social-standings social-standings--collapsed" : "social-standings social-standings--expanded"}>
                        <button type="button" className="social-standings__header" onClick={() => setIsRoundStandingsCollapsed((current) => !current)} aria-expanded={!isRoundStandingsCollapsed}>
                          <span className="social-standings__title">{isRoundStandingsCollapsed ? "Show results" : "Results"}</span>
                          <span className={isRoundStandingsCollapsed ? "social-standings__caret" : "social-standings__caret social-standings__caret--expanded"} aria-hidden="true">
                            ▾
                          </span>
                        </button>
                        <div className="social-standings__body">
                          <table className="social-standings__table">
                            <thead>
                              <tr>
                                <th scope="col">#</th>
                                <th scope="col">Name</th>
                                <th scope="col">Distance</th>
                                <th scope="col">Points</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentRoundStandings.map((standing) => (
                                <tr key={standing.key} className={standing.isCurrentUser ? "social-standings__row social-standings__row--current" : "social-standings__row"}>
                                  <td>{standing.rank}</td>
                                  <td>
                                    <span className="social-standings__player">
                                      <span className="social-standings__avatar" aria-hidden="true" style={{ backgroundColor: standing.avatarColor }}>
                                        {standing.avatarLabel}
                                      </span>
                                      <span className="social-standings__name">{standing.displayName}</span>
                                    </span>
                                  </td>
                                  <td>{formatDistance(standing.distanceKm)} km</td>
                                  <td>{standing.points}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="control-actions">
                      <button type="button" className="button button--primary" onClick={roundIndex === targets.length - 1 ? openFinalResults : goToNextRound}>
                        {roundIndex === targets.length - 1 ? "View Summary" : "Next location"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="control-actions control-actions--single">
                    <button type="button" className="button button--primary button--confirm" onClick={submitGuess} disabled={actionState.isLoading}>
                      {actionState.isLoading ? "Saving guess..." : "Confirm guess"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {isUserPanelOpen && user ? (
        <UserPanel
          createAccountError={createPasswordState.error}
          createAccountHandle={createAccountHandle}
          createAccountPassword={createAccountPassword}
          follows={followsState.data}
          followsError={followsState.error}
          followsLoading={followsState.isLoading}
          isGuest={isGuestUser}
          loginError={loginState.error}
          loginHandle={loginHandle}
          loginLoading={loginState.isLoading}
          loginPassword={loginPassword}
          onClose={() => setIsUserPanelOpen(false)}
          onCreateAccountHandleChange={setCreateAccountHandle}
          onCreateAccountPasswordChange={setCreateAccountPassword}
          onCreatePassword={createPassword}
          onLogin={loginToExistingAccount}
          onLoginHandleChange={setLoginHandle}
          onLoginPasswordChange={setLoginPassword}
          onUnfollow={unfollowUser}
          unfollowingHandle={unfollowingHandle}
          user={user}
          userAvatarColor={userAvatarColor}
          userAvatarLabel={userAvatarLabel}
        />
      ) : null}

      {isFinished && !showSummaryMap ? (
        <section className="overlay overlay--finish" aria-label="Final score">
          <div className="finish-card">
            <div className="panel-header panel-header--finish">
              <p className="eyebrow eyebrow--left">{challengeHeaderLabel}</p>
              <div className="player-badge" aria-label={`Current player ${user.handle}`}>
                <button type="button" className="player-badge__button" onClick={() => setIsUserPanelOpen((current) => !current)}>
                  <span className="player-badge__handle">{user.handle}</span>
                  <span className="player-badge__avatar" aria-hidden="true" style={{ backgroundColor: userAvatarColor }}>
                    {userAvatarLabel}
                  </span>
                </button>
              </div>
            </div>
            <div className="round-indicators" aria-label={`Results for ${targets.length} rounds`}>
              {results.map((result) => (
                <span
                  key={result.target.name}
                  className="round-indicator"
                  style={{ backgroundColor: getRoundScoreColor(result.points) }}
                  aria-label={`${result.target.name}: ${result.points} points`}
                  title={`${result.target.name}: ${result.points} points`}
                ></span>
              ))}
            </div>
            <h2>
              {totalPoints}/{maxPoints} Points
            </h2>
            <div className="finish-verdict">
              <p>Check back tomorrow for a fresh set of locations.</p>
            </div>
            <div className="finish-actions finish-actions--stacked">
              <button type="button" className="button button--primary" onClick={shareScore}>
                Challenge your friends
              </button>
              {isMobileViewport ? (
                <button type="button" className="button button--ghost" onClick={() => setShowSummaryMap(true)}>
                  Show on Map
                </button>
              ) : null}
            </div>
            {activeError ? <p className="error-banner">{activeError}</p> : null}
            {shareMessage ? <p className="share-message">{shareMessage}</p> : null}

            <section className="friends-board" aria-label="Friends results">
              <div className="friends-board__header">
                <h3>Friends</h3>
              </div>
              {leaderboardRows.length > 0 ? (
                <div className="friends-board__table-wrap">
                  <table className="friends-board__table">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Player</th>
                        <th scope="col">Total</th>
                        {targets.map((target, index) => (
                          <th key={target.name} scope="col">
                            R{index + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardRows.map((row, rowIndex) => (
                        <tr key={row.playerKey} className={row.isCurrentUser ? "friends-board__row friends-board__row--current" : "friends-board__row"}>
                          <td>{rowIndex + 1}</td>
                          <th scope="row">
                            <span className="friends-board__player-wrap">
                              <span className="friends-board__avatar" aria-hidden="true" style={{ backgroundColor: row.avatarColor }}>
                                {row.avatarLabel}
                              </span>
                              <span className="friends-board__player">{row.displayName}</span>
                            </span>
                          </th>
                          <td>{row.totalPoints}</td>
                          {row.perRoundPoints.map((points, index) => (
                            <td key={`${row.playerKey}-${index}`} className={points !== null && points === leaderboardRoundLeaders[index] ? "friends-board__cell--leader" : undefined}>
                              {points ?? "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="friends-board__empty">No followed-player results are available yet.</p>
              )}
            </section>

            <ul className="finish-list" aria-label="Round results">
              {results.map((result, index) => (
                <li key={result.target.name} className="finish-list__item">
                  <div className="finish-list__meta">
                    <span className="eyebrow">Round {index + 1}</span>
                    <span className="finish-list__score-wrap">
                      <span className="round-indicator finish-list__indicator" style={{ backgroundColor: getRoundScoreColor(result.points) }} aria-hidden="true"></span>
                      <strong className="finish-list__score">{result.points} Points</strong>
                      <span className="finish-list__distance">({formatDistance(result.distanceKm)} km)</span>
                    </span>
                  </div>
                  <h3 className="finish-list__title">
                    {result.target.name}, {result.target.region}
                    {result.target.isoCountryCode ? (
                      <span className="challenge-region-flag" aria-label={result.target.region} title={result.target.region}>
                        {getFlagEmoji(result.target.isoCountryCode)}
                      </span>
                    ) : null}
                  </h3>
                  {result.target.text ? <p className="finish-list__description">{result.target.text}</p> : null}
                  {getWikipediaLink(result.target) ? (
                    <a className="finish-list__link" href={getWikipediaLink(result.target)} target="_blank" rel="noreferrer">
                      {getWikipediaLink(result.target)}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
