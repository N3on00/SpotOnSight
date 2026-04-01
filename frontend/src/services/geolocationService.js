import { webStorage } from './webStorage'

const GEOLOCATION_STORAGE_KEY = 'geolocation_prefs'
const GEOLOCATION_TIMEOUT_MS = 10000
const EUROPE_FALLBACK_ZOOM = 5

const SWITZERLAND_CENTER = [46.8182, 8.2275]
const SWITZERLAND_BOUNDS = [
  [45.5, 5.5],
  [47.9, 10.6],
]
const EUROPE_CENTER = [50.1109, 10.4515]
const EUROPE_BOUNDS = [
  [35, -11],
  [61, 31],
]

const DEFAULT_NEAR_RADIUS_KM = 25

function loadStoredPrefs() {
  try {
    const raw = webStorage.getItem(GEOLOCATION_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStoredPrefs(prefs) {
  try {
    webStorage.setItem(GEOLOCATION_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage errors
  }
}

export function getDefaultBounds() {
  return SWITZERLAND_BOUNDS
}

export function getDefaultCenter() {
  return SWITZERLAND_CENTER
}

export function getDefaultRadiusKm() {
  return DEFAULT_NEAR_RADIUS_KM
}

export function getStoredLocation() {
  const prefs = loadStoredPrefs()
  if (!prefs) return null

  const lat = Number(prefs.lat)
  const lon = Number(prefs.lon)
  const radiusKm = Number(prefs.radiusKm)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }

  return {
    lat,
    lon,
    radiusKm: Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : DEFAULT_NEAR_RADIUS_KM,
    timestamp: prefs.timestamp,
  }
}

export async function getCurrentPosition() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      success: false,
      error: 'Geolocation not supported',
      fallback: {
        center: EUROPE_CENTER,
        bounds: EUROPE_BOUNDS,
        radiusKm: DEFAULT_NEAR_RADIUS_KM,
        zoom: EUROPE_FALLBACK_ZOOM,
      },
    }
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: 'Geolocation timeout',
        fallback: {
          center: EUROPE_CENTER,
          bounds: EUROPE_BOUNDS,
          radiusKm: DEFAULT_NEAR_RADIUS_KM,
          zoom: EUROPE_FALLBACK_ZOOM,
        },
      })
    }, GEOLOCATION_TIMEOUT_MS)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId)

        const lat = position.coords.latitude
        const lon = position.coords.longitude

        saveStoredPrefs({
          lat,
          lon,
          radiusKm: DEFAULT_NEAR_RADIUS_KM,
          timestamp: Date.now(),
        })

        const bounds = [
          [lat - 0.5, lon - 0.8],
          [lat + 0.5, lon + 0.8],
        ]

        resolve({
          success: true,
          location: {
            lat,
            lon,
            radiusKm: DEFAULT_NEAR_RADIUS_KM,
            accuracy: position.coords.accuracy,
          },
          bounds,
        })
      },
      (err) => {
        clearTimeout(timeoutId)

        let errorMessage = 'Unknown error'
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Permission denied'
            break
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Position unavailable'
            break
          case err.TIMEOUT:
            errorMessage = 'Timeout'
            break
        }

        resolve({
          success: false,
          error: errorMessage,
          fallback: {
            center: EUROPE_CENTER,
            bounds: EUROPE_BOUNDS,
            radiusKm: DEFAULT_NEAR_RADIUS_KM,
            zoom: EUROPE_FALLBACK_ZOOM,
          },
        })
      },
      {
        enableHighAccuracy: false,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 300000,
      }
    )
  })
}

export function updateStoredRadius(radiusKm) {
  const prefs = loadStoredPrefs() || {}
  prefs.radiusKm = Math.max(1, Math.min(500, Number(radiusKm) || DEFAULT_NEAR_RADIUS_KM))
  saveStoredPrefs(prefs)
}

export function requestGeolocationPermission() {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return Promise.resolve('granted')
  }

  return navigator.permissions
    .query({ name: 'geolocation' })
    .then((result) => result.state)
    .catch(() => 'granted')
}
