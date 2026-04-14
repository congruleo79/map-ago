import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet"
import { divIcon } from "leaflet"
import type { DivIcon, LatLngLiteral, LeafletMouseEvent } from "leaflet"
import { GeodesicLine } from "leaflet.geodesic"
import "leaflet/dist/leaflet.css"
import "./App.css"
import { getDailyChallenge } from "./dailyChallenges"
import type { LocationTarget } from "./dailyChallenges"

type RoundResult = {
  target: LocationTarget
  guess: LatLngLiteral
  distanceKm: number
  points: number
}

type StoredRoundResult = {
  guess: LatLngLiteral
  distanceKm: number
  points: number
}

type StoredCompletedGame = {
  version: 1
  dateKey: string
  results: StoredRoundResult[]
}

const earthHalfCircumferenceKm = Math.PI * 6371
const perfectToleranceKm = 10
const mapAttribution = "&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
const defaultCenter: [number, number] = [18, 11]
const defaultZoom = 2
const worldOffsets = [-360, 0, 360]
const completedGameStorageKeyPrefix = "mapago:completed-game:"
const guessPinIcon = createPinIcon("map-pin map-pin--guess")
const targetPinIcon = createPinIcon("map-pin map-pin--target")

function getCompletedGameStorageKey(dateKey: string) {
  return `${completedGameStorageKeyPrefix}${dateKey}`
}

function isStoredRoundResult(value: unknown): value is StoredRoundResult {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<StoredRoundResult>

  return (
    !!candidate.guess &&
    typeof candidate.guess.lat === "number" &&
    Number.isFinite(candidate.guess.lat) &&
    typeof candidate.guess.lng === "number" &&
    Number.isFinite(candidate.guess.lng) &&
    typeof candidate.distanceKm === "number" &&
    Number.isFinite(candidate.distanceKm) &&
    typeof candidate.points === "number" &&
    Number.isFinite(candidate.points)
  )
}

function loadCompletedGameResults(dateKey: string, targets: LocationTarget[]) {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const storedValue = window.localStorage.getItem(getCompletedGameStorageKey(dateKey))

    if (!storedValue) {
      return null
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredCompletedGame>

    if (parsedValue.version !== 1 || parsedValue.dateKey !== dateKey || !Array.isArray(parsedValue.results) || parsedValue.results.length !== targets.length) {
      return null
    }

    if (!parsedValue.results.every(isStoredRoundResult)) {
      return null
    }

    return parsedValue.results.map((result, index) => ({
      target: targets[index],
      guess: result.guess,
      distanceKm: result.distanceKm,
      points: result.points,
    }))
  } catch {
    return null
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function getDistanceKm(a: LatLngLiteral, b: LatLngLiteral) {
  const latDelta = toRadians(b.lat - a.lat)
  const lngDelta = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const haversine = Math.sin(latDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2

  return 2 * 6371 * Math.asin(Math.sqrt(haversine))
}

function getPoints(distanceKm: number) {
  if (distanceKm <= perfectToleranceKm) {
    return 100
  }

  const normalizedDistance = Math.min(distanceKm, earthHalfCircumferenceKm)
  const linearRatio = 1 - (normalizedDistance - perfectToleranceKm) / (earthHalfCircumferenceKm - perfectToleranceKm)
  const scoreRatio = linearRatio ** 6

  return Math.max(0, Math.floor(scoreRatio * 100))
}

function createPinIcon(className: string): DivIcon {
  return divIcon({
    className: "map-pin-icon",
    html: `
      <svg class="${className}" width="30" height="42" viewBox="0 0 30 42" aria-hidden="true">
        <path d="M15 1C8.373 1 3 6.373 3 13c0 9.728 9.252 18.472 11.321 26.427a.7.7 0 0 0 1.358 0C17.748 31.472 27 22.728 27 13 27 6.373 21.627 1 15 1Z" />
        <circle cx="15" cy="13" r="5.25" />
      </svg>
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

function getRoundTease(distanceKm: number) {
  if (distanceKm <= perfectToleranceKm) {
    return "🎉 Spot on! That was insanely accurate."
  }

  if (distanceKm <= 20) {
    return "🤏 Sooo close!'"
  }

  if (distanceKm <= 42.2) {
    return "🏃 Nice! You could probably run the distance."
  }

  if (distanceKm <= 120) {
    return "🚗 Alright, that's only about an hour drive away."
  }

  if (distanceKm <= 500) {
    return "🧭 You were in the general neighborhood..."
  }

  if (distanceKm <= 1500) {
    return "😬 That's a short flight away..."
  }

  if (distanceKm <= 4000) {
    return "🫠 That was a bold regional interpretation..."
  }

  return "😵 Ouch, better luck next time. At least you definitely picked the right planet."
}

function getRoundScoreColor(points: number) {
  const clampedPoints = Math.max(0, Math.min(100, points))
  const hue = (clampedPoints / 100) ** 2 * 120

  return `hsl(${hue} 72% 48%)`
}

function getDifficultyTag(views?: number) {
  if ((views ?? 0) > 100000) {
    return { label: "Easy", tone: "easy" as const }
  }

  if ((views ?? 0) > 10000) {
    return { label: "Medium", tone: "medium" as const }
  }

  if ((views ?? 0) > 1000) {
    return { label: "Hard", tone: "hard" as const }
  }

  return { label: "Insane", tone: "insane" as const }
}

function getShareSquares(points: number) {
  const clampedPoints = Math.max(0, Math.min(100, points))
  const greenCount = Math.floor(clampedPoints / 20)
  const yellowCount = clampedPoints < 100 && clampedPoints % 20 >= 10 ? 1 : 0
  const redCount = 5 - greenCount - yellowCount

  return `${"🟩".repeat(greenCount)}${"🟨".repeat(yellowCount)}${"🟥".repeat(redCount)}`
}

function getFinalScoreMood(totalPoints: number, maxPoints: number) {
  const scoreRatio = maxPoints === 0 ? 0 : totalPoints / maxPoints

  if (scoreRatio >= 0.99) {
    return {
      emoji: "⚡",
      level: "God",
      message: "The map never had a chance.",
    }
  }

  if (scoreRatio >= 0.9) {
    return {
      emoji: "🔥",
      level: "Master",
      message: "That was a seriously sharp run.",
    }
  }

  if (scoreRatio >= 0.8) {
    return {
      emoji: "🧭",
      level: "Expert",
      message: "Solid instincts. A few tighter guesses would push this higher.",
    }
  }

  return {
    emoji: "🙂",
    level: "Novice",
    message: "The map won this time, but you are on the board.",
  }
}

function formatShareDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

function getOverrideDateFromUrl() {
  if (typeof window === "undefined") {
    return null
  }

  const overrideDate = new URLSearchParams(window.location.search).get("overridedate")

  if (!overrideDate) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(overrideDate)

  if (!match) {
    return null
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsedDate = new Date(year, month - 1, day)

  if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return null
  }

  return parsedDate
}

function getWikipediaLink(target: LocationTarget) {
  return target.link
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

function MapDistanceBridge({ distanceCalculatorRef }: { distanceCalculatorRef: React.MutableRefObject<((a: LatLngLiteral, b: LatLngLiteral) => number) | null> }) {
  const map = useMap()

  useEffect(() => {
    distanceCalculatorRef.current = (start, destination) => map.distance(start, destination) / 1000

    return () => {
      distanceCalculatorRef.current = null
    }
  }, [distanceCalculatorRef, map])

  return null
}

function MapViewportController({
  guess,
  isMobileViewport,
  revealTarget,
  roundIndex,
  target,
}: {
  guess: LatLngLiteral | null
  isMobileViewport: boolean
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
    if (!guess || !revealTarget) {
      return
    }

    const wrappedTarget = getWrappedTargetForDisplay(guess, target)
    const mapHeight = map.getSize().y
    const topPadding = isMobileViewport ? Math.max(Math.round(mapHeight * 0.42), 220) : 48
    const bottomPadding = isMobileViewport ? 32 : 48

    map.fitBounds(
      [
        [guess.lat, guess.lng],
        [wrappedTarget.lat, wrappedTarget.lng],
      ],
      {
        animate: true,
        duration: 0.5,
        paddingTopLeft: [48, topPadding],
        paddingBottomRight: [48, bottomPadding],
        maxZoom: 6,
      },
    )
  }, [guess, isMobileViewport, map, revealTarget, target])

  return null
}

function GeodesicConnection({ guess, revealTarget, target }: { guess: LatLngLiteral | null; revealTarget: boolean; target: LatLngLiteral }) {
  const map = useMap()

  useEffect(() => {
    if (!guess || !revealTarget) {
      return
    }

    const geodesics = getWrappedGuessTargetPairs(guess, target).map(({ guess: guessCopy, target: targetCopy }) => {
      return new GeodesicLine([guessCopy, targetCopy], {
        color: "#f27d42",
        opacity: 0.9,
        weight: 3,
        steps: 6,
        wrap: false,
      }).addTo(map)
    })

    return () => {
      geodesics.forEach((geodesic) => {
        map.removeLayer(geodesic)
      })
    }
  }, [guess, map, revealTarget, target])

  return null
}

function GameMap({
  distanceCalculatorRef,
  guess,
  isMobileViewport,
  onMapInteract,
  revealTarget,
  roundIndex,
  target,
  onGuess,
}: {
  distanceCalculatorRef: React.MutableRefObject<((a: LatLngLiteral, b: LatLngLiteral) => number) | null>
  guess: LatLngLiteral | null
  isMobileViewport: boolean
  onMapInteract: () => void
  revealTarget: boolean
  roundIndex: number
  target: LatLngLiteral
  onGuess: (nextGuess: LatLngLiteral) => void
}) {
  const map = useMap()
  const displayedTarget = revealTarget ? getWrappedTargetForDisplay(guess, target) : target
  const guessCopies = guess ? getWrappedCopies(guess) : []
  const targetCopies = revealTarget ? getWrappedCopies(displayedTarget) : []

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
      <MapDistanceBridge distanceCalculatorRef={distanceCalculatorRef} />
      <MapViewportController guess={guess} isMobileViewport={isMobileViewport} revealTarget={revealTarget} roundIndex={roundIndex} target={displayedTarget} />
      {guessCopies.map((guessCopy) => (
        <Marker key={`guess-${guessCopy.lng}`} position={guessCopy} icon={guessPinIcon} />
      ))}

      {revealTarget ? (
        <>
          {targetCopies.map((targetCopy) => (
            <Marker key={`target-${targetCopy.lng}`} position={targetCopy} icon={targetPinIcon} />
          ))}
          <GeodesicConnection guess={guess} revealTarget={revealTarget} target={displayedTarget} />
        </>
      ) : null}
    </>
  )
}

function App() {
  const dailyChallenge = useMemo(() => getDailyChallenge(getOverrideDateFromUrl() ?? new Date()), [])
  const targets = dailyChallenge.targets
  const persistedResults = useMemo(() => loadCompletedGameResults(dailyChallenge.dateKey, targets), [dailyChallenge.dateKey, targets])
  const [roundIndex, setRoundIndex] = useState(persistedResults ? targets.length - 1 : 0)
  const [guess, setGuess] = useState<LatLngLiteral | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [hasInteractedWithMap, setHasInteractedWithMap] = useState(false)
  const [isChallengeTextExpanded, setIsChallengeTextExpanded] = useState(true)
  const [results, setResults] = useState<RoundResult[]>(persistedResults ?? [])
  const [showFinalResults, setShowFinalResults] = useState(Boolean(persistedResults))
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const distanceCalculatorRef = useRef<((a: LatLngLiteral, b: LatLngLiteral) => number) | null>(null)

  const currentTarget = targets[roundIndex]
  const difficultyTag = currentTarget ? getDifficultyTag(currentTarget.views) : null
  const latestResult = results.at(-1) ?? null
  const isRoundResolved = results.length > roundIndex
  const isAllRoundsScored = results.length === targets.length
  const isFinished = isAllRoundsScored && showFinalResults
  const currentRound = Math.min(roundIndex + 1, targets.length)
  const maxPoints = targets.length * 100
  const totalPoints = useMemo(() => results.reduce((sum, result) => sum + result.points, 0), [results])
  const finalScoreMood = useMemo(() => getFinalScoreMood(totalPoints, maxPoints), [maxPoints, totalPoints])
  const isChallengeCollapsed = isMobileViewport && hasInteractedWithMap && !isChallengeTextExpanded && !isRoundResolved
  const shareDate = useMemo(() => formatShareDate(dailyChallenge.dateKey), [dailyChallenge.dateKey])

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
    if (typeof window === "undefined") {
      return
    }

    const storageKey = getCompletedGameStorageKey(dailyChallenge.dateKey)

    if (!isAllRoundsScored) {
      window.localStorage.removeItem(storageKey)
      return
    }

    const storedGame: StoredCompletedGame = {
      version: 1,
      dateKey: dailyChallenge.dateKey,
      results: results.map(({ guess: roundGuess, distanceKm, points }) => ({
        guess: roundGuess,
        distanceKm,
        points,
      })),
    }

    window.localStorage.setItem(storageKey, JSON.stringify(storedGame))
  }, [dailyChallenge.dateKey, isAllRoundsScored, results])

  const shareText = useMemo(() => {
    const perRound = results.map((result) => `${getShareSquares(result.points)} ${result.points}% (${formatDistance(result.distanceKm)} km)`).join("\n")

    return `MapAgo ${shareDate}\nCan you beat ${totalPoints}/${maxPoints}?\n${perRound}\n`
  }, [maxPoints, results, shareDate, totalPoints])

  function submitGuess() {
    if (!guess || !currentTarget || isRoundResolved) {
      return
    }

    const distanceKm = distanceCalculatorRef.current ? distanceCalculatorRef.current(guess, currentTarget.coordinates) : getDistanceKm(guess, currentTarget.coordinates)
    const points = getPoints(distanceKm)

    setResults((previous) => [
      ...previous,
      {
        target: currentTarget,
        guess,
        distanceKm,
        points,
      },
    ])
    setShowFinalResults(false)
    setShareMessage(null)
    setIsChallengeTextExpanded(true)
  }

  function goToNextRound() {
    if (!isRoundResolved) {
      return
    }

    setRoundIndex((previous) => previous + 1)
    setGuess(null)
    setHasInteractedWithMap(false)
    setIsChallengeTextExpanded(true)
    setShareMessage(null)
  }

  function openFinalResults() {
    if (!isAllRoundsScored) {
      return
    }

    setShowFinalResults(true)
    setShareMessage(null)
  }

  async function shareScore() {
    try {
      const shareUrl = typeof window === "undefined" ? "" : window.location.href

      if (isMobileViewport && typeof navigator.share === "function") {
        await navigator.share({
          title: "MapAgo score",
          text: shareText,
          url: shareUrl,
        })
        setShareMessage("Score shared.")
        return
      }

      await navigator.clipboard.writeText(shareText + "\n" + shareUrl)
      setShareMessage("Score copied to clipboard.")
    } catch {
      setShareMessage("Sharing was cancelled or blocked.")
    }
  }

  return (
    <main className="game-shell">
      <MapContainer center={defaultCenter} className="game-map" worldCopyJump zoom={defaultZoom} zoomControl={false} minZoom={2} maxZoom={7}>
        <TileLayer attribution={mapAttribution} url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        {!isFinished && currentTarget ? (
          <GameMap
            distanceCalculatorRef={distanceCalculatorRef}
            guess={guess}
            isMobileViewport={isMobileViewport}
            onMapInteract={() => {
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
        ) : null}
      </MapContainer>

      {!isFinished ? (
        <section className="overlay overlay--top" aria-label="Round information">
          <div className="hud-card hud-card--top">
            <div className="hud-card__row">
              <p className="eyebrow eyebrow--left">
                Round {currentRound} / {targets.length}
              </p>
              <p className="eyebrow eyebrow--right" aria-label={`Score ${totalPoints} points`}>
                {totalPoints} pts
              </p>
            </div>
            <div className="round-indicators" aria-label={`Progress: round ${currentRound} of ${targets.length}`}>
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
              {!isChallengeCollapsed && !isRoundResolved ? <p className="challenge-kicker">Tap as close as possible to</p> : null}
              <h1 className={isChallengeCollapsed ? "challenge-title challenge-title--collapsed" : "challenge-title"}>
                <span>
                  {currentTarget.name}, {currentTarget.region}
                </span>
                {difficultyTag ? <span className={`difficulty-tag difficulty-tag--${difficultyTag.tone}`}>{difficultyTag.label}</span> : null}
              </h1>
              {currentTarget.text && !isRoundResolved ? (
                <div className={isChallengeCollapsed ? "challenge-text challenge-text--collapsed" : "challenge-text challenge-text--expanded"}>
                  <span className="challenge-text__content">{currentTarget.text}</span>
                </div>
              ) : null}
            </div>

            {guess || isRoundResolved ? (
              <div className="top-card-status">
                {isRoundResolved ? (
                  <>
                    <div className="control-copy">
                      <h2>
                        {latestResult ? <span className="round-points">{latestResult.points} Points</span> : "Round scored"}
                        {latestResult ? <span className="round-distance">{` ${formatDistance(latestResult.distanceKm)} km away`}</span> : null}
                      </h2>
                      <p>{latestResult ? getRoundTease(latestResult.distanceKm) : ""}</p>
                    </div>

                    <div className="control-actions">
                      <button type="button" className="button button--primary" onClick={roundIndex === targets.length - 1 ? openFinalResults : goToNextRound}>
                        {roundIndex === targets.length - 1 ? "Show results" : "Next location"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="control-actions control-actions--single">
                    <button type="button" className="button button--primary button--confirm" onClick={submitGuess}>
                      Confirm guess
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {isFinished ? (
        <section className="overlay overlay--finish" aria-label="Final score">
          <div className="finish-card">
            <p className="eyebrow eyebrow--left">{shareDate}</p>
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
              <p className="finish-verdict__badge">
                <span className="finish-verdict__emoji">{finalScoreMood.emoji}</span>
                <span className="finish-verdict__label">{finalScoreMood.level}</span>
              </p>
              <p className="lead finish-verdict__message">{finalScoreMood.message}</p>
              <p>Check back tomorrow for a fresh set of locations.</p>
            </div>
            <div className="finish-actions">
              <button type="button" className="button button--primary" onClick={shareScore}>
                Share score
              </button>
            </div>
            {shareMessage ? <p className="share-message">{shareMessage}</p> : null}
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
                  </h3>
                  {result.target.text ? <p className="finish-list__description">{result.target.text}</p> : null}
                  <a className="finish-list__link" href={getWikipediaLink(result.target)} target="_blank" rel="noreferrer">
                    {getWikipediaLink(result.target)}
                  </a>
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
