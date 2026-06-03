import React, { useState, useEffect, useRef, useCallback } from 'react'
import Landing from './Landing.jsx'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPORTED_DAY_ROUTES   = ['3', '9', '11', '15', '22', '25', '33', '38', '52', '53', '55', '72', '73', '88', '101', '134', '148', '149', '243', '350', '370', '405', '465']
const SUPPORTED_NIGHT_ROUTES  = ['N8', 'N11', 'N22', 'N25', 'N29', 'N38', 'N53', 'N55', 'N133', 'N155', 'N207']
const DEFAULT_ROUTE           = 'all'
const ARRIVALS_REFRESH_INTERVAL_MS = 30_000
const DEAD_RECKONING_TICK_MS  = 1_000
const TRAIL_LENGTH_SECONDS    = 40

const LONDON_CENTER = [51.505, -0.09]
const DEFAULT_ZOOM  = 12

const DAY_TILE_URL   = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const NIGHT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Direction colours — single-route mode
const OUTBOUND_COLOR = '#e67300'
const INBOUND_COLOR  = '#2171b5'

// Per-route colours — all-routes mode (bus dots)
const ROUTE_COLORS = {
  // Central routes
  '11': '#d62828', '22': '#2a9d8f', '33': '#c8890a', '55': '#7b5ea7', '88': '#1d7ab5',
  // First outer ring
  '3':   '#ec4899',  // south      — hot pink
  '25':  '#10b981',  // east       — emerald
  '134': '#6366f1',  // north      — indigo
  // Second outer ring
  '52':  '#f97316',  // northwest  — orange
  '149': '#0891b2',  // northeast  — dark cyan
  '101': '#16a34a',  // far east   — forest green
  '53':  '#be185d',  // southeast  — deep pink
  '72':  '#ca8a04',  // southwest  — gold
  // Outer fringe / beyond M25
  '350': '#b45309',  // far east Essex   — amber brown
  '370': '#0f766e',  // far east Essex   — dark teal
  '405': '#7c3aed',  // far south Surrey — violet
  '465': '#dc2626',  // far south Surrey — crimson
  // New day routes
  '9':   '#0284c7',  // central/west — cerulean blue
  '15':  '#be123c',  // east/city    — rose red
  '38':  '#7e22ce',  // north/central— dark purple
  '73':  '#854d0e',  // north/central— sienna brown
  '148': '#166534',  // west/south   — deep forest green
  '243': '#9f1239',  // north/central— burgundy
  // Night routes
  'N11': '#a855f7',  'N55': '#22d3ee',
  'N29': '#fb923c',  // north      — peach orange
  'N38': '#34d399',  // northeast  — mint
  'N25': '#fbbf24',  // east       — amber gold
  'N53': '#60a5fa',  // southeast  — sky blue
  'N207':'#e879f9',  // west       — fuchsia
  // New night routes
  'N8':   '#6d28d9', // east       — deep violet
  'N22':  '#15803d', // south      — dark green
  'N133': '#0e7490', // south/city — dark cyan
  'N155': '#9d174d', // south      — deep rose
}

// Per-route lighter colours — OSRM route lines
const ROUTE_LINE_COLORS = {
  '11': '#f08a8a', '22': '#82c4bc', '33': '#f5c84a', '55': '#b39fd4', '88': '#6baed6',
  '3':  '#f9a8d4', '25': '#6ee7b7', '134': '#a5b4fc',
  '52': '#fed7aa', '149': '#a5f3fc', '101': '#bbf7d0', '53': '#fbcfe8', '72': '#fef08a',
  '350': '#fcd34d', '370': '#99f6e4', '405': '#ddd6fe', '465': '#fca5a5',
  '9':   '#7dd3fc', '15': '#fda4af', '38': '#e9d5ff', '73': '#fef3c7',
  '148': '#86efac', '243': '#fecdd3',
  'N11': '#d8b4fe', 'N55': '#a5f3fc',
  'N29': '#fed7aa', 'N38': '#a7f3d0', 'N25': '#fde68a', 'N53': '#bfdbfe', 'N207': '#f5d0fe',
  'N8':   '#ede9fe', 'N22': '#dcfce7', 'N133': '#cffafe', 'N155': '#fce7f3',
}

const ROUTE_DESTINATIONS = {
  'all': 'All Routes',
  '9':  'Aldwych',       '11': 'Liverpool St',     '15': 'Trafalgar Sq',
  '22': 'Piccadilly',    '33': 'Hammersmith',
  '38': 'Victoria',      '55': 'Oxford Circus',    '73': 'Victoria',
  '88': 'Clapham Common',
  '3':  'Crystal Palace','25': 'Ilford',            '134': 'High Barnet',
  '52': 'Willesden',     '148': 'Camberwell Grn',  '149': 'Edmonton',
  '101': 'Gallions Reach','243': 'Wood Green',
  '53': 'Plumstead',     '72': 'Roehampton',
  '350': 'Lakeside',     '370': 'Grays',            '405': 'Redhill',
  '465': 'Dorking',
  'N8':  'Hainault',     'N11': 'Liverpool St',     'N22': 'Crystal Palace',
  'N25': 'Ilford',       'N29': 'Wood Green',       'N38': 'Clapton',
  'N53': 'Plumstead',    'N55': 'Oxford Circus',    'N133': 'Streatham',
  'N155': 'Tooting',     'N207': 'Uxbridge',
}

// London bus operating hours (approximate, for display only)
const DAY_SERVICE_HOURS   = '05:30 – 00:30'
const NIGHT_SERVICE_HOURS = '00:00 – 06:00'

// Colours assigned dynamically to rail replacement routes (dot, then lighter line)
const REPLACEMENT_DOT_PALETTE  = ['#f59e0b','#ef4444','#8b5cf6','#06b6d4','#10b981','#f97316','#ec4899','#6366f1','#14b8a6','#a855f7']
const REPLACEMENT_LINE_PALETTE = ['#fde68a','#fca5a5','#ddd6fe','#a5f3fc','#6ee7b7','#fed7aa','#fbcfe8','#c7d2fe','#99f6e4','#d8b4fe']

// Official TfL tube + Elizabeth line colours
const TUBE_LINE_COLORS = {
  'bakerloo':         '#B36305',
  'central':          '#E32017',
  'circle':           '#FFD300',
  'district':         '#00782A',
  'hammersmith-city': '#F3A9BB',
  'jubilee':          '#A0A5A9',
  'metropolitan':     '#9B0056',
  'northern':         '#1C1C1C',
  'piccadilly':       '#003688',
  'victoria':         '#0098D4',
  'waterloo-city':    '#95CDBA',
  'elizabeth':        '#6950A1',
}

const TUBE_LINE_SHORT = {
  'bakerloo':         'Bakerloo',
  'central':          'Central',
  'circle':           'Circle',
  'district':         'District',
  'hammersmith-city': 'H & City',
  'jubilee':          'Jubilee',
  'metropolitan':     'Metropolitan',
  'northern':         'Northern',
  'piccadilly':       'Piccadilly',
  'victoria':         'Victoria',
  'waterloo-city':    'W & City',
  'elizabeth':        'Elizabeth',
}

const TUBE_LINE_IDS = [
  'bakerloo', 'central', 'circle', 'district', 'hammersmith-city',
  'jubilee', 'metropolitan', 'northern', 'piccadilly', 'victoria',
  'waterloo-city', 'elizabeth',
]

// Notable places each route passes — stored as arrays for easy expansion
const ROUTE_LANDMARKS = {
  '3':   ['Brixton Academy', 'Lambeth Palace', 'Crystal Palace Park'],
  '9':   ['Kensington High Street', 'Hyde Park Corner', 'Aldwych'],
  '11':  ["King's Road Chelsea", 'Victoria Station', "St Paul's Cathedral"],
  '15':  ['Whitechapel', 'Monument', 'Trafalgar Square'],
  '22':  ['Green Park', 'Hyde Park Corner', 'Sloane Square'],
  '25':  ["St Paul's Cathedral", 'Bank of England', 'Stratford'],
  '33':  ['Hammersmith Apollo', 'Chiswick House', 'Richmond Bridge'],
  '38':  ['Angel Islington', 'Bloomsbury', 'Victoria Coach Station'],
  '52':  ['Notting Hill Gate', 'Ladbroke Grove', 'Kensal Rise'],
  '53':  ['Trafalgar Square', 'Elephant & Castle', 'Greenwich'],
  '55':  ['Oxford Circus', 'Bloomsbury', 'Old Street'],
  '72':  ["Shepherd's Bush", 'Hammersmith', 'Putney Bridge'],
  '73':  ['Stoke Newington', 'Angel', 'Hyde Park Corner'],
  '88':  ['Clapham Common', 'Vauxhall', 'Trafalgar Square'],
  '101': ['Stratford Westfield', 'West Ham', 'Royal Docks'],
  '134': ['Archway', 'Highgate Village', 'East Finchley'],
  '148': ["Shepherd's Bush", 'Notting Hill', 'Westminster Bridge'],
  '149': ['Liverpool Street', 'Stoke Newington', 'Tottenham'],
  '243': ['Wood Green', 'Holloway Road', 'Waterloo Bridge'],
  '350': ['Romford Market', 'Hornchurch', 'Lakeside Shopping Centre'],
  '370': ['Lakeside', 'Tilbury Docks', 'Thames Estuary'],
  '405': ['East Croydon', 'Coulsdon', 'Redhill (Surrey)'],
  '465': ['Kingston upon Thames', 'Leatherhead', 'Dorking (beyond M25)'],
  'N8':  ['Bethnal Green', 'Shoreditch High Street', 'Oxford Street'],
  'N11': ["King's Road", 'Westminster', 'Liverpool Street'],
  'N22': ['Chelsea', 'Oxford Street', 'Crystal Palace'],
  'N25': ['Oxford Circus', 'Bank', 'Stratford'],
  'N29': ['Trafalgar Square', 'Finsbury Park', 'Wood Green'],
  'N38': ['Victoria', 'Hackney', 'Clapton'],
  'N53': ['Whitehall', 'Elephant & Castle', 'Plumstead'],
  'N55': ['Oxford Circus', 'Shoreditch', 'Leyton'],
  'N133':['Elephant & Castle', 'London Bridge', 'Streatham'],
  'N155':['Oval', 'Kennington', 'Tooting Broadway'],
  'N207':["Shepherd's Bush", 'Ealing', 'Uxbridge'],
}

// ─── TfL & OSRM API helpers ───────────────────────────────────────────────────

async function fetchArrivals(routeId) {
  const response = await fetch(`https://api.tfl.gov.uk/Line/${routeId}/Arrivals`)
  if (!response.ok) throw new Error(`TfL arrivals fetch failed: ${response.status}`)
  return response.json()
}

async function fetchStopSequence(routeId, direction) {
  const response = await fetch(`https://api.tfl.gov.uk/Line/${routeId}/Route/Sequence/${direction}`)
  if (!response.ok) throw new Error(`TfL sequence fetch failed: ${response.status}`)
  const data = await response.json()
  const sequences = data.stopPointSequences
  if (!sequences || sequences.length === 0) return []
  const longest = sequences.reduce((best, seq) =>
    seq.stopPoint.length > best.stopPoint.length ? seq : best
  )
  return longest.stopPoint.map(stop => ({
    id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon,
  }))
}

async function fetchOsrmRoute(stops) {
  if (stops.length < 2) return null
  // Subsample to ≤30 waypoints — avoids URL length limits and OSRM timeouts on
  // long outer routes like X26 (Heathrow–Croydon) that have 100+ stops.
  let sample = stops
  if (stops.length > 30) {
    const step = Math.ceil(stops.length / 28)
    sample = stops.filter((_, i) => i === 0 || i === stops.length - 1 || i % step === 0)
  }
  const coordString = sample.map(s => `${s.lon},${s.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    if (!data.routes || data.routes.length === 0) return null
    return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon])
  } catch {
    return null
  }
}

async function fetchTubeStatus() {
  const res = await fetch('https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line/Status')
  if (!res.ok) throw new Error('Tube status fetch failed')
  const lines = await res.json()
  return lines
    .filter(l => TUBE_LINE_IDS.includes(l.id))
    .map(line => ({
      id:          line.id,
      name:        TUBE_LINE_SHORT[line.id] || line.name,
      severity:    line.lineStatuses?.[0]?.statusSeverity ?? 10,
      description: line.lineStatuses?.[0]?.statusSeverityDescription ?? 'Unknown',
    }))
}

async function fetchStrikeNotices() {
  try {
    const today = new Date()
    const fmt   = d => d.toISOString().split('T')[0]
    const end   = fmt(new Date(today.getTime() + 14 * 86_400_000))
    const res   = await fetch(
      `https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line/Status/${fmt(today)}/${end}`
    )
    if (!res.ok) return []
    const lines = await res.json()
    const notices = []
    lines.forEach(line => {
      line.lineStatuses?.forEach(status => {
        const reason = status.reason || ''
        if (!reason) return
        const lo = reason.toLowerCase()
        if (lo.includes('industrial action') || lo.includes('strike') ||
            lo.includes('rmt') || lo.includes('aslef') || lo.includes('tssa')) {
          notices.push(`${line.name}: ${reason.trim()}`)
        }
      })
    })
    return notices
  } catch {
    return []
  }
}

async function fetchReplacementRouteIds() {
  try {
    const res = await fetch('https://api.tfl.gov.uk/Line/Mode/replacement-bus')
    if (!res.ok) return []
    const lines = await res.json()
    return lines.map(l => l.id)
  } catch {
    return []
  }
}

// Direct stop-to-stop polyline — used as fallback when OSRM fails or times out.
function stopsToPolyline(stops) {
  if (stops.length < 2) return null
  return stops.map(s => [s.lat, s.lon])
}

function calculatePolylineDistanceKm(polyline) {
  if (!polyline || polyline.length < 2) return 0
  let total = 0
  for (let i = 1; i < polyline.length; i++) {
    const [lat1, lon1] = polyline[i - 1]
    const [lat2, lon2] = polyline[i]
    const R    = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a    = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return Math.round(total * 10) / 10
}

// ─── Bus interpolation ────────────────────────────────────────────────────────

function buildStopLookup(stops) {
  const lookup = {}
  stops.forEach(stop => {
    lookup[stop.id] = stop
    lookup[stop.id.replace(/^490/, '')] = stop
  })
  return lookup
}

// For each stop, find the index of the nearest vertex in the OSRM polyline.
// Stored as { stopId: polylineIndex } so dead reckoning can interpolate on-road.
function buildStopPolylineMap(stops, polyline) {
  const map = {}
  stops.forEach(stop => {
    let minDist = Infinity
    let nearestIdx = 0
    polyline.forEach(([lat, lon], i) => {
      const dist = Math.hypot(lat - stop.lat, lon - stop.lon)
      if (dist < minDist) { minDist = dist; nearestIdx = i }
    })
    map[stop.id] = nearestIdx
    map[stop.id.replace(/^490/, '')] = nearestIdx
  })
  return map
}

function interpolateBusData(arrivals, stopLookup) {
  const vehicleGroups = {}
  arrivals.forEach(a => {
    if (!vehicleGroups[a.vehicleId]) vehicleGroups[a.vehicleId] = []
    vehicleGroups[a.vehicleId].push(a)
  })

  const buses = []
  Object.entries(vehicleGroups).forEach(([vehicleId, predictions]) => {
    const sorted = [...predictions].sort((a, b) => a.timeToStation - b.timeToStation)
    const next  = sorted[0]
    const after = sorted[1]
    if (!next || !after) return

    const nextStop  = stopLookup[next.naptanId]  || stopLookup[next.stationId]
    const afterStop = stopLookup[after.naptanId] || stopLookup[after.stationId]
    if (!nextStop || !afterStop) return

    const gapSeconds = after.timeToStation - next.timeToStation
    if (gapSeconds <= 0) return

    buses.push({
      vehicleId, nextStop, afterStop,
      timeToNextStop: next.timeToStation,
      gapSeconds,
      destination:  next.destinationName,
      nextStopName: next.stationName || next.towards,
      direction:    next.direction,
    })
  })
  return buses
}

// ─── Road-snapped interpolation ───────────────────────────────────────────────
// Traverses the OSRM polyline between two stop-mapped indices and returns
// the lat/lon at parameter t (0 = fromIdx position, 1 = toIdx position).

function interpolateAlongPolyline(polyline, fromIdx, toIdx, t) {
  if (!polyline || fromIdx === undefined || toIdx === undefined) return null
  if (fromIdx === toIdx) return { lat: polyline[fromIdx][0], lon: polyline[fromIdx][1] }

  const ascending = fromIdx < toIdx
  const slice = polyline.slice(
    ascending ? fromIdx : toIdx,
    (ascending ? toIdx : fromIdx) + 1,
  )
  const points = ascending ? slice : [...slice].reverse()

  const distances = [0]
  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1]
    const [lat2, lon2] = points[i]
    distances.push(distances[i - 1] + Math.hypot(lat2 - lat1, lon2 - lon1))
  }

  const totalDist = distances[distances.length - 1]
  if (totalDist === 0) return { lat: points[0][0], lon: points[0][1] }

  const targetDist = Math.min(t, 1) * totalDist
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDist) {
      const segT = (targetDist - distances[i - 1]) / (distances[i] - distances[i - 1])
      const [lat1, lon1] = points[i - 1]
      const [lat2, lon2] = points[i]
      return { lat: lat1 + (lat2 - lat1) * segT, lon: lon1 + (lon2 - lon1) * segT }
    }
  }

  const last = points[points.length - 1]
  return { lat: last[0], lon: last[1] }
}

// Find the index of the nearest vertex in a polyline to a given lat/lon.
// Used to robustly snap stop positions onto the OSRM geometry.
function findNearestPolylineIdx(lat, lon, polyline) {
  let minDist = Infinity
  let nearestIdx = 0
  for (let i = 0; i < polyline.length; i++) {
    const d = Math.hypot(polyline[i][0] - lat, polyline[i][1] - lon)
    if (d < minDist) { minDist = d; nearestIdx = i }
  }
  return nearestIdx
}

// Extract the polyline segment that remains between the bus's current position
// and its next stop. This is used to render the road-snapped reaching line.
function extractReachingPolyline(lat, lon, polyline, afterIdx, nextIdx) {
  if (!polyline || afterIdx === undefined || nextIdx === undefined) return null
  if (afterIdx === nextIdx) return null

  const ascending  = afterIdx < nextIdx
  const rangeStart = Math.min(afterIdx, nextIdx)
  const rangeEnd   = Math.max(afterIdx, nextIdx)

  // Find the nearest vertex to the bus within its current segment
  let nearestInRange = rangeStart
  let minDist = Infinity
  for (let i = rangeStart; i <= rangeEnd; i++) {
    const d = Math.hypot(polyline[i][0] - lat, polyline[i][1] - lon)
    if (d < minDist) { minDist = d; nearestInRange = i }
  }

  // Slice from nearest vertex to the next-stop vertex
  let segment
  if (ascending) {
    segment = polyline.slice(nearestInRange, nextIdx + 1)
  } else {
    segment = [...polyline.slice(nextIdx, nearestInRange + 1)].reverse()
  }

  if (segment.length < 1) return null
  return [[lat, lon], ...segment]  // exact bus position as the first point
}

// ─── Dead reckoning ───────────────────────────────────────────────────────────

function deadReckonPosition(busData, nowMs, polyline) {
  const elapsedSec        = (nowMs - busData.fetchedAt) / 1000
  const currentTimeToNext = Math.max(0, busData.timeToNextStop - elapsedSec)
  const { gapSeconds }    = busData
  const t = gapSeconds > 0
    ? Math.min(1, Math.max(0, 1 - currentTimeToNext / (currentTimeToNext + gapSeconds)))
    : 1

  // Prefer road-snapped interpolation when polyline indices are available
  const snapped = interpolateAlongPolyline(
    polyline,
    busData.afterStopPolylineIdx,
    busData.nextStopPolylineIdx,
    t,
  )
  if (snapped) {
    return { ...snapped, minutesToNextStop: Math.round(currentTimeToNext / 60) }
  }

  // Fallback: straight-line between stop coordinates
  const { nextStop, afterStop } = busData
  return {
    lat: afterStop.lat + (nextStop.lat - afterStop.lat) * t,
    lon: afterStop.lon + (nextStop.lon - afterStop.lon) * t,
    minutesToNextStop: Math.round(currentTimeToNext / 60),
  }
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const isNightRoute = routeId => routeId.startsWith('N')

function getBusColor(routeId, direction, isAllMode) {
  if (isAllMode || isNightRoute(routeId)) {
    return ROUTE_COLORS[routeId] || extraRouteColors[routeId] || '#888'
  }
  return direction === 'inbound' ? INBOUND_COLOR : OUTBOUND_COLOR
}

function getRouteLineColor(routeId, isAllMode, viewMode) {
  if (viewMode === 'static') return ROUTE_COLORS[routeId] || extraRouteColors[routeId] || '#888'
  if (isAllMode || isNightRoute(routeId)) {
    return ROUTE_LINE_COLORS[routeId] || extraRouteLineColors[routeId] || '#aaa'
  }
  return '#1a1a1a'
}

// Fires onClickEmpty when the user clicks the map canvas rather than a layer.
// Route polylines and bus markers set bubblingMouseEvents={false} so their clicks
// don't reach this handler.
function MapClickHandler({ onClickEmpty }) {
  useMapEvents({ click: onClickEmpty })
  return null
}

// ─── Headway / frequency helpers ─────────────────────────────────────────────

// Compute median headway in minutes from a raw TfL arrivals array.
// Groups predictions by stop, finds gaps between consecutive bus times,
// then takes the median to avoid outliers from buses far in the future.
function calculateHeadwayMinutes(allArrivals) {
  if (!allArrivals || allArrivals.length === 0) return null

  const byStop = {}
  allArrivals.forEach(a => {
    const stopId = a.naptanId || a.stationId
    if (!stopId) return
    if (!byStop[stopId]) byStop[stopId] = []
    byStop[stopId].push(a.timeToStation)
  })

  const gaps = []
  Object.values(byStop).forEach(times => {
    if (times.length < 2) return
    const sorted = [...times].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      const gapSec = sorted[i] - sorted[i - 1]
      if (gapSec > 30 && gapSec < 3600) gaps.push(gapSec)
    }
  })

  if (gaps.length === 0) return null
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)] / 60 // median gap in minutes
}

function getHeadwayColor(headwayMinutes) {
  if (headwayMinutes === null || headwayMinutes === undefined) return null
  if (headwayMinutes < 5)  return '#2d9e5f'
  if (headwayMinutes < 10) return '#f0b429'
  if (headwayMinutes < 20) return '#e67300'
  return '#cc2936'
}

// ─── Bunching detection ───────────────────────────────────────────────────────
// Buses on the same route+direction within ~400 m of each other are "bunching".
// The rear bus (lower polyline progress) is flagged; the front bus is left normal.

const BUNCHING_THRESHOLD_DEG = 0.0045 // ≈ 450 m at London's latitude

function detectBunching(buses) {
  const bunchedIds = new Set()
  const pairs = [] // [{ rear, front }]

  // Group by route + direction so we don't cross-compare different services
  const groups = {}
  buses.forEach(bus => {
    const key = `${bus.routeId}::${bus.direction || 'any'}`
    if (!groups[key]) groups[key] = []
    groups[key].push(bus)
  })

  Object.values(groups).forEach(group => {
    if (group.length < 2) return
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (Math.hypot(a.lat - b.lat, a.lon - b.lon) > BUNCHING_THRESHOLD_DEG) continue

        // Determine which is "rear": lower polyline index for outbound = behind,
        // higher polyline index for inbound = behind.
        const aIdx = a.afterStopPolylineIdx ?? 0
        const bIdx = b.afterStopPolylineIdx ?? 0
        const aIsOutbound = a.direction !== 'inbound'
        const rear  = aIsOutbound ? (aIdx <= bIdx ? a : b) : (aIdx >= bIdx ? a : b)
        const front = rear === a ? b : a

        if (!bunchedIds.has(rear.vehicleId)) {
          bunchedIds.add(rear.vehicleId)
          pairs.push({ rear, front })
        }
      }
    }
  })

  return { bunchedIds, pairs }
}

// ─── Bus dot + trail ──────────────────────────────────────────────────────────

// Two overlapping polylines with offset pulse animations create a travelling-wave
// effect along the road-snapped segment from the bus to its next stop.
function ReachingLine({ positions, isBunched, color }) {
  if (!positions || positions.length < 2) return null
  const lineColor = isBunched ? '#e63946' : color
  const weight    = isBunched ? 3 : 2
  return (
    <>
      <Polyline positions={positions}
        pathOptions={{ color: lineColor, weight, lineCap: 'round', lineJoin: 'round',
          className: isBunched ? 'reach-a-bunched' : 'reach-a' }} />
      <Polyline positions={positions}
        pathOptions={{ color: lineColor, weight, lineCap: 'round', lineJoin: 'round',
          className: isBunched ? 'reach-b-bunched' : 'reach-b' }} />
    </>
  )
}

function BusDot({ vehicleId, lat, lon, direction, destination, nextStopName,
                  minutesToNextStop, routeId, isAllMode, isBunched }) {
  const dotColor  = getBusColor(routeId, direction, isAllMode)
  const fillColor = isBunched ? '#e63946' : dotColor

  return (
    <>
      <CircleMarker
        center={[lat, lon]}
        radius={9}
        bubblingMouseEvents={false}
        pathOptions={{ color: '#fff', fillColor: fillColor, fillOpacity: 1, weight: 2.5 }}
      >
        <Popup>
          <div style={styles.popup}>
            <div style={styles.popupRoute}>Route {routeId}</div>
            {isBunched && <div style={styles.popupBunching}>⚠ Bunching detected</div>}
            <div style={styles.popupDestination}>→ {destination}</div>
            <div style={styles.popupDetail}>
              <span style={styles.popupLabel}>Next stop</span>
              <span style={styles.popupValue}>{nextStopName}</span>
            </div>
            <div style={styles.popupDetail}>
              <span style={styles.popupLabel}>ETA</span>
              <span style={styles.popupValue}>{minutesToNextStop} min</span>
            </div>
            <div style={styles.popupVehicle}>Vehicle {vehicleId}</div>
          </div>
        </Popup>
      </CircleMarker>
    </>
  )
}

// ─── Animated bus blind text ──────────────────────────────────────────────────
// Replicates the mechanical roll of a destination blind when route changes.
// Old text exits upward, new text enters from below — both during 400 ms.

function AnimatedBlindText({ text, textStyle, height = 28 }) {
  const [curr, setCurr]   = useState(text)
  const [prev, setPrev]   = useState(null)
  const [animId, setAnimId] = useState(0)

  useEffect(() => {
    if (text === curr) return
    setPrev(curr)
    setCurr(text)
    setAnimId(id => id + 1)
    const timer = setTimeout(() => setPrev(null), 500)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <div style={{ overflow: 'hidden', position: 'relative', height }}>
      {prev !== null && (
        <div
          key={`out-${animId}`}
          style={{
            ...textStyle,
            position: 'absolute',
            top: 0, left: 0,
            animation: 'blindOut 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            whiteSpace: 'nowrap',
          }}
        >
          {prev}
        </div>
      )}
      <div
        key={`in-${animId}`}
        style={{
          ...textStyle,
          animation: animId > 0 ? 'blindIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
          opacity: animId > 0 ? 0 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {curr}
      </div>
    </div>
  )
}

// ─── Custom route dropdown ────────────────────────────────────────────────────

function RouteDropdown({ selectedRoute, onRouteChange, availableRoutes }) {
  const [isOpen, setIsOpen]       = useState(false)
  const [hoveredRoute, setHovered] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        role="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(v => !v)}
        style={styles.blindRouteSection}
      >
        <AnimatedBlindText
          text={selectedRoute === 'all' ? 'All' : selectedRoute}
          textStyle={styles.blindRouteText}
          height={28}
        />
        <span style={{
          ...styles.blindArrow,
          display: 'inline-block',
          transition: 'transform 0.2s',
          transform: isOpen ? 'rotate(180deg)' : 'none',
        }}>↓</span>
      </div>

      {isOpen && (
        <div style={styles.dropdownPanel}>
          {/* "All routes" always at top, outside the scroll area */}
          <div
            onMouseEnter={() => setHovered('all')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { onRouteChange('all'); setIsOpen(false) }}
            style={{ ...styles.dropdownOption, background: hoveredRoute === 'all' || selectedRoute === 'all' ? '#2a2a2a' : 'transparent' }}
          >
            <span style={styles.dropdownOptionLabel}>All routes</span>
            {selectedRoute === 'all' && <span style={styles.dropdownCheck}>✓</span>}
          </div>
          <div style={styles.dropdownDivider} />
          {/* Individual routes — sorted numerically, scrollable 5 at a time */}
          <div className="route-dropdown-scroll" style={styles.dropdownScroll}>
          {[...availableRoutes]
            .sort((a, b) => parseInt(a.replace(/^N/, ''), 10) - parseInt(b.replace(/^N/, ''), 10))
            .map(route => (
            <div
              key={route}
              onMouseEnter={() => setHovered(route)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { onRouteChange(route); setIsOpen(false) }}
              style={{ ...styles.dropdownOption, background: hoveredRoute === route || selectedRoute === route ? '#2a2a2a' : 'transparent' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ROUTE_COLORS[route] || extraRouteColors[route], display: 'inline-block' }} />
              <span style={styles.dropdownRouteNumber}>{route}</span>
              <span style={styles.dropdownRouteDest}>— {ROUTE_DESTINATIONS[route]}</span>
              {selectedRoute === route && <span style={styles.dropdownCheck}>✓</span>}
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Route facts chip ─────────────────────────────────────────────────────────

function RouteFacts({ selectedRoute, isAllMode, routeStops, routePolylines, animatedBuses, currentRoutes }) {
  if (isAllMode) {
    // Aggregate summary across all loaded routes
    const totalBuses    = animatedBuses.length
    const loadedRoutes  = Object.keys(routePolylines)
    const totalStops    = Object.values(routeStops).reduce((sum, d) => sum + d.outboundStops.length, 0)
    const totalDistKm   = loadedRoutes.reduce((sum, id) => sum + calculatePolylineDistanceKm(routePolylines[id]), 0)

    if (loadedRoutes.length === 0) return null

    return (
      <div style={styles.factChip}>
        <div style={styles.factTitle}>All Routes</div>
        <div style={styles.factDivider} />
        <div style={styles.factGrid}>
          <FactRow label="Buses running" value={totalBuses} />
          <FactRow label="Routes loaded"  value={loadedRoutes.length} />
          <FactRow label="Combined dist."  value={`${Math.round(totalDistKm)} km`} />
          <FactRow label="Total stops"    value={totalStops} />
        </div>
      </div>
    )
  }

  // Single route
  const stops       = routeStops[selectedRoute]
  const polyline    = routePolylines[selectedRoute]
  const busCount    = animatedBuses.filter(b => b.routeId === selectedRoute).length
  const stopCount   = stops ? stops.outboundStops.length : '—'
  const distKm      = polyline ? calculatePolylineDistanceKm(polyline) : null
  const landmarks   = ROUTE_LANDMARKS[selectedRoute] || []

  if (!polyline && !stops) return null

  return (
    <div style={styles.factChip}>
      <div style={styles.factTitle}>Route {selectedRoute}</div>
      <div style={styles.factDivider} />
      <div style={styles.factGrid}>
        <FactRow label="Buses running" value={busCount} />
        <FactRow label="Stops"         value={stopCount} />
        {distKm !== null && <FactRow label="Distance" value={`${distKm} km`} />}
      </div>
      {landmarks.length > 0 && (
        <>
          <div style={styles.factDivider} />
          <div style={styles.factLandmarkLabel}>Passes</div>
          {landmarks.map(l => (
            <div key={l} style={styles.factLandmark}>{l}</div>
          ))}
        </>
      )}
    </div>
  )
}

function FactRow({ label, value }) {
  return (
    <div style={styles.factRow}>
      <span style={styles.factLabel}>{label}</span>
      <span style={styles.factValue}>{value}</span>
    </div>
  )
}

// ─── Destination blind ─────────────────────────────────────────────────────────

function DestinationBlind({ selectedRoute, onRouteChange, availableRoutes, serviceMode }) {
  const isNightMode       = serviceMode === 'night'
  const isReplacementMode = serviceMode === 'replacement'
  return (
    <div style={styles.blindFloatRow}>
      <div style={{
        ...styles.blindPill,
        background: isNightMode ? '#0a0a1a' : '#0d0d0d',
        boxShadow: isNightMode
          ? '0 8px 32px rgba(168,85,247,0.25), 0 2px 8px rgba(0,0,0,0.6)'
          : isReplacementMode
          ? '0 8px 32px rgba(245,158,11,0.25), 0 2px 8px rgba(0,0,0,0.6)'
          : '0 8px 32px rgba(0,0,0,0.45)',
      }}>
        {isNightMode       && <div style={styles.nightBadge}>N</div>}
        {isReplacementMode && <div style={styles.replacementBadge}>RR</div>}
        <div style={styles.blindDestinationSection}>
          <AnimatedBlindText
            text={ROUTE_DESTINATIONS[selectedRoute] || selectedRoute}
            textStyle={styles.blindDestinationText}
            height={28}
          />
        </div>
        <RouteDropdown
          selectedRoute={selectedRoute}
          onRouteChange={onRouteChange}
          availableRoutes={availableRoutes}
        />
      </div>
    </div>
  )
}

// ─── Icon buttons — bottom right controls ─────────────────────────────────────

// ─── Heatmap legend ───────────────────────────────────────────────────────────

const HEADWAY_SCALE = [
  { color: '#2d9e5f', label: '< 5 min',   desc: 'High frequency' },
  { color: '#f0b429', label: '5–10 min',  desc: '' },
  { color: '#e67300', label: '10–20 min', desc: '' },
  { color: '#cc2936', label: '> 20 min',  desc: 'Low frequency' },
]

function HeatmapLegend({ routeHeadways, loadedRouteIds }) {
  const hasNoData = loadedRouteIds.some(
    id => routeHeadways[id] === null || routeHeadways[id] === undefined
  )

  return (
    <div style={styles.legend}>
      <div style={styles.legendTitle}>Frequency (headway)</div>
      {HEADWAY_SCALE.map(({ color, label }) => (
        <div key={label} style={styles.legendRow}>
          <div style={{ width: 24, height: 4, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={styles.legendText}>{label}</span>
        </div>
      ))}
      {hasNoData && (
        <>
          <div style={styles.legendRow}>
            <div style={{ width: 24, height: 4, borderRadius: 2, background: '#aaa', opacity: 0.5, flexShrink: 0 }} />
            <span style={styles.legendText}>No data</span>
          </div>
          <div style={styles.heatmapNoDataNote}>
            No live frequency data available
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tube mode blind (replaces destination blind in tube view) ───────────────

function TubeModeBlind({ isNightMode }) {
  return (
    <div style={styles.blindFloatRow}>
      <div style={{
        ...styles.blindPill,
        background: isNightMode ? '#0a0a1a' : '#0d0d0d',
        boxShadow: isNightMode
          ? '0 8px 32px rgba(168,85,247,0.25), 0 2px 8px rgba(0,0,0,0.6)'
          : '0 8px 32px rgba(0,0,0,0.45)',
      }}>
        <div style={styles.tubeRoundel}>
          <div style={styles.tubeRoundelBar} />
        </div>
        <div style={styles.blindDestinationSection}>
          <span style={styles.blindDestinationText}>London Underground</span>
        </div>
      </div>
    </div>
  )
}

// ─── Strike ticker ────────────────────────────────────────────────────────────

function StrikeTicker({ notices }) {
  const items  = notices === null ? ['Loading strike information…']
    : notices.length > 0 ? notices
    : ['No upcoming industrial action planned', 'All lines operating normally', 'Data sourced from TfL API']

  const text = items.join('  ·  ')
  const full = `${text}  ·  ${text}`  // doubled for seamless loop

  const color = notices && notices.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.45)'
  const label = notices && notices.length > 0 ? '⚠ STRIKE' : 'ALERTS'
  const labelColor = notices && notices.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.3)'

  return (
    <div style={styles.tickerContainer}>
      <span style={{ ...styles.tickerLabel, color: labelColor }}>{label}</span>
      <div style={styles.tickerTrack}>
        <span className="strike-ticker" style={{ ...styles.tickerText, color }}>{full}</span>
      </div>
    </div>
  )
}

// ─── Tube heatmap legend ──────────────────────────────────────────────────────

const TUBE_STATUS_SCALE = [
  { color: null,      label: 'Good Service',   desc: 'Official line colour' },
  { color: '#f59e0b', label: 'Delays',          desc: '' },
  { color: '#ef4444', label: 'Severe / Closed', desc: '' },
]

function TubeHeatmapLegend({ tubeStatus }) {
  const disrupted = tubeStatus.filter(l => l.severity < 10).length
  return (
    <div style={styles.legend}>
      <div style={styles.legendTitle}>Line Status</div>
      {TUBE_STATUS_SCALE.map(({ color, label }) => (
        <div key={label} style={styles.legendRow}>
          <div style={{ width: 24, height: 4, borderRadius: 2, background: color || '#6950A1', flexShrink: 0 }} />
          <span style={styles.legendText}>{label}</span>
        </div>
      ))}
      {disrupted > 0 && (
        <div style={{ ...styles.heatmapNoDataNote, color: '#f59e0b' }}>
          {disrupted} line{disrupted > 1 ? 's' : ''} with disruptions
        </div>
      )}
    </div>
  )
}

// ─── Tube status chip ─────────────────────────────────────────────────────────

function TubeStatusChip({ tubeStatus }) {
  if (!tubeStatus || tubeStatus.length === 0) return null

  return (
    <div style={styles.tubeChip}>
      <div style={styles.tubeChipTitle}>Tube Status</div>
      <div style={styles.factDivider} />
      {tubeStatus.map(line => {
        const isGood   = line.severity >= 10
        const isSevere = line.severity < 7
        const statusColor = isGood ? 'rgba(255,255,255,0.28)' : isSevere ? '#ef4444' : '#f59e0b'
        const dotBg = TUBE_LINE_COLORS[line.id] || '#888'
        return (
          <div key={line.id} style={styles.tubeLineRow}>
            <span style={{ ...styles.tubeLineDot, background: dotBg }} />
            <span style={styles.tubeLineName}>{line.name}</span>
            <span style={{ ...styles.tubeLineStatus, color: statusColor }}>
              {isGood ? '✓' : line.description}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Digital clock ────────────────────────────────────────────────────────────

function DigitalClock({ serviceMode }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const fmt = opts => now.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour12: false, ...opts })
  const hhmm = fmt({ hour: '2-digit', minute: '2-digit' })
  const secs = fmt({ second: '2-digit' }).slice(-2)

  const isNightMode = serviceMode === 'night'
  const label = serviceMode === 'replacement' ? '🔧 Rail replacement'
    : isNightMode ? '🌙 Night service'
    : '☀ Day service'
  const hours = isNightMode ? NIGHT_SERVICE_HOURS : serviceMode === 'replacement' ? 'Engineering works' : DAY_SERVICE_HOURS

  return (
    <div style={{ ...styles.clock, ...(isNightMode ? styles.clockNight : {}) }}>
      <div style={styles.clockTimeRow}>
        <span style={styles.clockHHMM}>{hhmm}</span>
        <span style={styles.clockSS}>{secs}</span>
      </div>
      <div style={styles.clockDivider} />
      <div style={styles.clockLabel}>{label}</div>
      <div style={styles.clockHours}>
        {hours}
      </div>
    </div>
  )
}

// ─── Bunching legend ──────────────────────────────────────────────────────────

function Legend() {
  return (
    <div style={styles.legend}>
      <div style={styles.legendTitle}>Bunching</div>
      <div style={styles.legendRow}>
        <span style={styles.legendDotRed} />
        <span style={styles.legendText}>Bus caught in bunch</span>
      </div>
      <div style={styles.legendRow}>
        <div style={styles.legendPulseLine} />
        <span style={styles.legendText}>Reaching next stop</span>
      </div>
      <div style={styles.legendRow}>
        <div style={styles.legendBand} />
        <span style={styles.legendText}>Gap zone</span>
      </div>
    </div>
  )
}

// ─── Icon buttons ─────────────────────────────────────────────────────────────

function IconButton({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 44, height: 44,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#0d0d0d' : '#efefef',
        color: active ? '#ffffff' : '#666',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// Globe — map tiles
function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

// Pin cluster — bus stops
function StopsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

// Curved path — route line
function RouteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="5" cy="18" r="2" fill="currentColor" stroke="none"/>
      <circle cx="19" cy="6" r="2" fill="currentColor" stroke="none"/>
      <path d="M5 16V13a7 7 0 0 1 7-7h5"/>
    </svg>
  )
}

// Signal rings — live view
function LiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/>
      <path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>
    </svg>
  )
}

// Bar chart — static/data view
function StaticIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3"  y="12" width="4" height="9" rx="1"/>
      <rect x="10" y="7"  width="4" height="14" rx="1"/>
      <rect x="17" y="3"  width="4" height="18" rx="1"/>
    </svg>
  )
}

// Frequency heatmap — three horizontal bars in green/yellow/red
function HeatmapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <rect x="2" y="3"  width="20" height="5" rx="1.5" fill="#2d9e5f"/>
      <rect x="2" y="10" width="20" height="5" rx="1.5" fill="#f0b429"/>
      <rect x="2" y="17" width="20" height="5" rx="1.5" fill="#cc2936"/>
    </svg>
  )
}

// Moon — switch to night mode
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

// Sun — switch to day mode
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

// Bus — bus mode
function BusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="13" rx="2"/>
      <path d="M2 10h20"/>
      <circle cx="7" cy="20" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="17" cy="20" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

// Tube roundel — tube mode
function TubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="2" y="9.5" width="20" height="5" rx="1" fill="currentColor"/>
    </svg>
  )
}

// Wrench — rail replacement mode
function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

function ControlsPanel({ appMode, onSetAppMode,
                          mapVisible, onToggleMap, stopsVisible, onToggleStops,
                          routeLineVisible, onToggleRouteLine, serviceMode, onSetServiceMode,
                          viewMode, onToggleViewMode, heatmapVisible, onToggleHeatmap }) {
  const isNightMode       = serviceMode === 'night'
  const isReplacementMode = serviceMode === 'replacement'
  const isBusMode  = appMode === 'bus'
  const isTubeMode = appMode === 'tube'
  return (
    <div style={styles.controlsPanel}>
      {/* Mode toggle */}
      <IconButton active={isBusMode}  onClick={() => onSetAppMode('bus')}  title="Bus mode"><BusIcon /></IconButton>
      <IconButton active={isTubeMode} onClick={() => onSetAppMode('tube')} title="Tube mode"><TubeIcon /></IconButton>
      <div style={styles.controlsDivider} />

      {/* Bus-only controls */}
      {isBusMode && <>
        <IconButton
          active={viewMode === 'live'}
          onClick={onToggleViewMode}
          title={viewMode === 'live' ? 'Switch to static view' : 'Switch to live view'}
        >
          {viewMode === 'live' ? <LiveIcon /> : <StaticIcon />}
        </IconButton>
        <IconButton active={heatmapVisible} onClick={onToggleHeatmap} title="Frequency heatmap">
          <HeatmapIcon />
        </IconButton>
        <IconButton active={stopsVisible}     onClick={onToggleStops}     title="Bus stops"><StopsIcon /></IconButton>
        <IconButton active={routeLineVisible} onClick={onToggleRouteLine} title="Route line"><RouteIcon /></IconButton>
        <IconButton active={isReplacementMode} onClick={() => onSetServiceMode(isReplacementMode ? 'day' : 'replacement')}
          title={isReplacementMode ? 'Exit rail replacement' : 'Rail replacement buses'}>
          <WrenchIcon />
        </IconButton>
      </>}

      {/* Shared controls */}
      <IconButton active={mapVisible} onClick={onToggleMap} title="Map tiles"><GlobeIcon /></IconButton>
      <IconButton active={isNightMode} onClick={() => onSetServiceMode(isNightMode ? 'day' : 'night')}
        title={isNightMode ? 'Switch to day' : 'Switch to night'}>
        {isNightMode ? <SunIcon /> : <MoonIcon />}
      </IconButton>
    </div>
  )
}

// ─── Debug timestamp ───────────────────────────────────────────────────────────

function DebugTimestamp({ lastUpdated }) {
  if (!lastUpdated) return null
  const timeString = lastUpdated.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  return <div style={styles.timestampPill}>{timeString}</div>
}

// ─── Geometry cache ───────────────────────────────────────────────────────────
// Module-level Map — survives route selection changes, cleared only on page reload.
// Keyed by routeId; stores stops + OSRM polyline so revisiting a route is instant.
const geometryCache = new Map()
// { routeId → { outStops, inStops, osrmPolyline } }

// Dynamic colours for replacement routes — populated when replacement mode activates.
const extraRouteColors     = {}
const extraRouteLineColors = {}

// Tube line geometry cache — straight-line stop sequences, no OSRM.
const tubeGeometryCache = new Map()

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [landingPhase,      setLandingPhase]      = useState('visible')
  const [transitioning,     setTransitioning]     = useState(false) // 'visible'|'spinning'|'fading'|'done'
  const [serviceMode,       setServiceMode]       = useState('day') // 'day' | 'night' | 'replacement'
  const [replacementRoutes, setReplacementRoutes] = useState([])
  const [viewMode,          setViewMode]          = useState('live') // 'live' | 'static'
  const [heatmapVisible,    setHeatmapVisible]    = useState(false)
  const [selectedRoute,     setSelectedRoute]     = useState(DEFAULT_ROUTE)
  const [mapVisible,        setMapVisible]        = useState(true)
  const [stopsVisible,      setStopsVisible]      = useState(true)
  const [routeLineVisible,  setRouteLineVisible]  = useState(true)
  const [routeStops,        setRouteStops]        = useState({})
  const [routePolylines,    setRoutePolylines]    = useState({})
  const [routeHeadways,     setRouteHeadways]     = useState({}) // { routeId: minutes | null }
  const [animatedBuses,     setAnimatedBuses]     = useState([])
  const [lastUpdated,       setLastUpdated]       = useState(null)
  const [tubeStatus,        setTubeStatus]        = useState([])
  const [appMode,           setAppMode]           = useState('bus') // 'bus' | 'tube'
  const [tubePolylines,     setTubePolylines]     = useState({})
  const [strikeNotices,     setStrikeNotices]     = useState(null) // null = loading

  const rawBusDataRef      = useRef({})
  const routePolylinesRef  = useRef({})
  const arrivalsTimerRef   = useRef(null)

  const isNightMode       = serviceMode === 'night'
  const isReplacementMode = serviceMode === 'replacement'
  const currentRoutes     = isReplacementMode ? replacementRoutes
    : isNightMode ? SUPPORTED_NIGHT_ROUTES
    : SUPPORTED_DAY_ROUTES
  const isAllMode    = selectedRoute === 'all'
  const isStaticView = viewMode === 'static'
  const tileUrl      = isNightMode ? NIGHT_TILE_URL : DAY_TILE_URL
  const mapBg        = isNightMode ? '#0d1117' : '#ffffff'

  // When the service mode flips, always go back to all routes
  useEffect(() => {
    setSelectedRoute(DEFAULT_ROUTE)
  }, [serviceMode])

  // ── Tube status — fetch on mount, refresh every 60 s ─────────────────────
  useEffect(() => {
    async function load() {
      try { setTubeStatus(await fetchTubeStatus()) } catch {}
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  // ── Tube geometry — load once when tube mode first opens ──────────────────
  useEffect(() => {
    if (appMode !== 'tube') return
    if (tubeGeometryCache.size === TUBE_LINE_IDS.length) {
      // already cached from a previous visit — restore from cache
      const restored = {}
      tubeGeometryCache.forEach((poly, id) => { if (poly) restored[id] = poly })
      setTubePolylines(restored)
      return
    }
    setTransitioning(true)
    async function load() {
      const entries = await Promise.all(TUBE_LINE_IDS.map(async id => {
        if (tubeGeometryCache.has(id)) return [id, tubeGeometryCache.get(id)]
        try {
          const stops = await fetchStopSequence(id, 'outbound')
          const poly  = stopsToPolyline(stops)
          tubeGeometryCache.set(id, poly)
          return [id, poly]
        } catch {
          tubeGeometryCache.set(id, null)
          return [id, null]
        }
      }))
      const map = {}
      entries.forEach(([id, poly]) => { if (poly) map[id] = poly })
      setTubePolylines(map)
      setTransitioning(false)
    }
    load()
  }, [appMode])

  // ── Strike notices — fetch once on mount (14-day look-ahead) ─────────────
  useEffect(() => {
    fetchStrikeNotices().then(setStrikeNotices)
  }, [])

  // ── Dead reckoning tick — runs every second ───────────────────────────────
  useEffect(() => {
    function tick() {
      const now = Date.now()
      const updated = []

      Object.entries(rawBusDataRef.current).forEach(([vehicleId, busData]) => {
        const polyline = routePolylinesRef.current[busData.routeId]
        const { lat, lon, minutesToNextStop } = deadReckonPosition(busData, now, polyline)

        updated.push({
          vehicleId, lat, lon,
          direction:            busData.direction,
          destination:          busData.destination,
          nextStopName:         busData.nextStopName,
          minutesToNextStop,
          routeId:              busData.routeId,
          afterStopPolylineIdx: busData.afterStopPolylineIdx,
        })
      })

      setAnimatedBuses(updated)
    }

    tick()
    const interval = setInterval(tick, DEAD_RECKONING_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  // ── Load arrivals and store timing + polyline-snap indices in rawBusDataRef ─
  const loadArrivals = useCallback(async (routeId, outStops, inStops) => {
    try {
      const allArrivals = await fetchArrivals(routeId)

      const outLookup = buildStopLookup(outStops)
      const inLookup  = buildStopLookup(inStops)
      const combined  = { ...outLookup, ...inLookup }

      const allBusData = [
        ...interpolateBusData(allArrivals.filter(a => a.direction === 'outbound'), Object.keys(outLookup).length ? outLookup : combined),
        ...interpolateBusData(allArrivals.filter(a => a.direction === 'inbound'),  Object.keys(inLookup).length  ? inLookup  : combined),
        ...interpolateBusData(allArrivals.filter(a => !a.direction), combined),
      ]

      // Snap each bus's surrounding stops onto the OSRM polyline using direct
      // lat/lon nearest-vertex lookup — more robust than ID matching.
      const polyline = routePolylinesRef.current[routeId]

      const seen = new Set()
      const now  = Date.now()
      allBusData.forEach(bus => {
        if (seen.has(bus.vehicleId)) return
        seen.add(bus.vehicleId)
        rawBusDataRef.current[bus.vehicleId] = {
          ...bus,
          fetchedAt: now,
          routeId,
          nextStopPolylineIdx:  polyline ? findNearestPolylineIdx(bus.nextStop.lat,  bus.nextStop.lon,  polyline) : undefined,
          afterStopPolylineIdx: polyline ? findNearestPolylineIdx(bus.afterStop.lat, bus.afterStop.lon, polyline) : undefined,
        }
      })

      // Compute headway from all arrivals and store for the frequency heatmap
      const headwayMinutes = calculateHeadwayMinutes(allArrivals)
      setRouteHeadways(prev => ({ ...prev, [routeId]: headwayMinutes }))

      setLastUpdated(new Date())
    } catch (err) {
      console.error(`Arrivals fetch failed for route ${routeId}:`, err)
    }
  }, [])

  // ── Route change: clear live data, load/restore geometry, then arrivals ──
  useEffect(() => {
    rawBusDataRef.current     = {}
    routePolylinesRef.current = {}
    setAnimatedBuses([])
    setRouteHeadways({})
    setTransitioning(true) // fade in the overlay to cover the old route
    if (arrivalsTimerRef.current) clearInterval(arrivalsTimerRef.current)

    async function initialize() {
      // In replacement mode, fetch the live list of replacement routes from TfL first.
      let modeRoutes
      if (isReplacementMode) {
        const ids = await fetchReplacementRouteIds()
        ids.forEach((id, i) => {
          extraRouteColors[id]     = REPLACEMENT_DOT_PALETTE[i % REPLACEMENT_DOT_PALETTE.length]
          extraRouteLineColors[id] = REPLACEMENT_LINE_PALETTE[i % REPLACEMENT_LINE_PALETTE.length]
        })
        setReplacementRoutes(ids)
        modeRoutes = ids
      } else {
        modeRoutes = isNightMode ? SUPPORTED_NIGHT_ROUTES : SUPPORTED_DAY_ROUTES
      }

      const routes = selectedRoute === 'all' ? modeRoutes : [selectedRoute]
      if (routes.length === 0) { setTransitioning(false); return }

      // Resolve geometry for each route — from cache if available, otherwise fetch.
      // Cache persists for the lifetime of the page so revisiting a route is instant.
      const geometries = await Promise.all(routes.map(async routeId => {
        if (geometryCache.has(routeId)) {
          const cached = geometryCache.get(routeId)
          // Re-populate the polyline ref (was cleared above)
          if (cached.osrmPolyline) routePolylinesRef.current[routeId] = cached.osrmPolyline
          return { routeId, outStops: cached.outStops, inStops: cached.inStops, osrmPolyline: cached.osrmPolyline }
        }

        // Not in cache — fetch stops first, then OSRM (needs outbound stops)
        const [outStops, inStops] = await Promise.all([
          fetchStopSequence(routeId, 'outbound'),
          fetchStopSequence(routeId, 'inbound'),
        ])
        const osrmPolyline = await fetchOsrmRoute(outStops)

        geometryCache.set(routeId, { outStops, inStops, osrmPolyline })
        return { routeId, outStops, inStops, osrmPolyline }
      }))

      const newRouteStops = {}
      const newPolylines  = {}
      geometries.forEach(({ routeId, outStops, inStops, osrmPolyline }) => {
        newRouteStops[routeId] = { outboundStops: outStops, inboundStops: inStops }
        const routeLine = osrmPolyline || stopsToPolyline(outStops)
        if (routeLine) {
          newPolylines[routeId] = routeLine
          routePolylinesRef.current[routeId] = routeLine
        }
      })
      setRouteStops(newRouteStops)
      setRoutePolylines(newPolylines)
      setTransitioning(false) // geometry ready — fade out the overlay

      // 3. Fetch arrivals — polyline is now in ref so stop→index mapping works
      // 4. Live-only: fetch arrivals and start refresh interval
      if (viewMode === 'live') {
        await Promise.all(
          geometries.map(({ routeId, outStops, inStops }) =>
            loadArrivals(routeId, outStops, inStops)
          )
        )

        arrivalsTimerRef.current = setInterval(async () => {
          await Promise.all(
            geometries.map(({ routeId, outStops, inStops }) =>
              loadArrivals(routeId, outStops, inStops)
            )
          )
        }, ARRIVALS_REFRESH_INTERVAL_MS)
      }
    }

    initialize()

    return () => {
      if (arrivalsTimerRef.current) clearInterval(arrivalsTimerRef.current)
    }
  }, [selectedRoute, serviceMode, viewMode, loadArrivals])

  const allOutboundStops  = Object.values(routeStops).flatMap(d => d.outboundStops)
  const allInboundStops   = Object.values(routeStops).flatMap(d => d.inboundStops)
  const loadedRouteIds    = Object.keys(routePolylines)
  const { bunchedIds, pairs: bunchingPairs } = detectBunching(animatedBuses)

  // When heatmap is toggled on while in static view, switch to live so we have arrivals data
  const handleToggleHeatmap = () => {
    if (!heatmapVisible && isStaticView) setViewMode('live')
    setHeatmapVisible(v => !v)
  }

  return (
    <div style={styles.appWrapper}>
      <div style={styles.mapWrapper}>
        {appMode === 'bus'  && (
          <DestinationBlind
            selectedRoute={selectedRoute}
            onRouteChange={setSelectedRoute}
            availableRoutes={currentRoutes}
            serviceMode={serviceMode}
          />
        )}
        {appMode === 'tube' && <TubeModeBlind isNightMode={isNightMode} />}

        <div style={styles.rightColumn}>
          <DigitalClock serviceMode={serviceMode} />
          <TubeStatusChip tubeStatus={tubeStatus} />
        </div>

        <MapContainer
          center={LONDON_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%', background: mapBg }}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={true}
          wheelDebounceTime={40}
          wheelPxPerZoomLevel={120}
        >
          {mapVisible && (
            <TileLayer url={tileUrl} attribution={TILE_ATTRIBUTION} opacity={isNightMode ? 0.85 : 0.45} />
          )}

          {/* Clicking empty map canvas resets to all-routes */}
          <MapClickHandler onClickEmpty={() => setSelectedRoute('all')} />

          {/* ── Bus mode map content ── */}
          {appMode === 'bus' && <>
            {(heatmapVisible || isStaticView || routeLineVisible) && Object.entries(routePolylines).map(([routeId, positions]) => {
              let lineColor, lineOpacity, lineWeight
              if (heatmapVisible) {
                const headwayColor = getHeadwayColor(routeHeadways[routeId])
                lineColor   = headwayColor ?? '#aaaaaa'
                lineOpacity = headwayColor ? 1 : 0.3
                lineWeight  = 5
              } else {
                lineColor   = getRouteLineColor(routeId, isAllMode, viewMode)
                lineOpacity = 1
                lineWeight  = isStaticView ? 4 : 2
              }
              return (
                <React.Fragment key={routeId}>
                  <Polyline positions={positions}
                    pathOptions={{ color: lineColor, opacity: lineOpacity, weight: lineWeight, lineCap: 'round' }} />
                  <Polyline positions={positions}
                    bubblingMouseEvents={false}
                    eventHandlers={{ click: () => setSelectedRoute(routeId) }}
                    pathOptions={{ opacity: 0.001, weight: 16, color: '#000' }} />
                </React.Fragment>
              )
            })}
            {stopsVisible && allOutboundStops.map(stop => (
              <CircleMarker key={`out-${stop.id}`} center={[stop.lat, stop.lon]} radius={2.5}
                bubblingMouseEvents={false}
                pathOptions={{ color: isNightMode ? '#555' : '#bbb', fillColor: isNightMode ? '#555' : '#bbb', fillOpacity: 1, weight: 0 }} />
            ))}
            {stopsVisible && allInboundStops.map(stop => (
              <CircleMarker key={`in-${stop.id}`} center={[stop.lat, stop.lon]} radius={2.5}
                bubblingMouseEvents={false}
                pathOptions={{ color: isNightMode ? '#555' : '#bbb', fillColor: isNightMode ? '#555' : '#bbb', fillOpacity: 1, weight: 0 }} />
            ))}
            {!isStaticView && !heatmapVisible && animatedBuses.map(bus => (
              <BusDot key={bus.vehicleId} {...bus} isAllMode={isAllMode} isBunched={bunchedIds.has(bus.vehicleId)} />
            ))}
          </>}

          {/* ── Tube mode map content — lines colored by service status ── */}
          {appMode === 'tube' && Object.entries(tubePolylines).map(([lineId, positions]) => {
            const entry    = tubeStatus.find(t => t.id === lineId)
            const severity = entry?.severity ?? 10
            const color    = severity >= 10 ? (TUBE_LINE_COLORS[lineId] || '#888')
              : severity >= 7 ? '#f59e0b'
              : '#ef4444'
            const opacity  = severity < 7 ? 0.55 : 1
            return (
              <Polyline key={lineId} positions={positions}
                pathOptions={{ color, opacity, weight: 5, lineCap: 'round', lineJoin: 'round' }} />
            )
          })}
        </MapContainer>

        {appMode === 'bus' && (
          <RouteFacts
            selectedRoute={selectedRoute}
            isAllMode={isAllMode}
            routeStops={routeStops}
            routePolylines={routePolylines}
            animatedBuses={animatedBuses}
            currentRoutes={currentRoutes}
          />
        )}

        {appMode === 'bus' && !isStaticView && !heatmapVisible && <Legend />}
        {appMode === 'bus' && heatmapVisible && (
          <HeatmapLegend routeHeadways={routeHeadways} loadedRouteIds={loadedRouteIds} />
        )}
        {appMode === 'tube' && <TubeHeatmapLegend tubeStatus={tubeStatus} />}

        <ControlsPanel
          appMode={appMode}                  onSetAppMode={setAppMode}
          mapVisible={mapVisible}            onToggleMap={() => setMapVisible(v => !v)}
          stopsVisible={stopsVisible}        onToggleStops={() => setStopsVisible(v => !v)}
          routeLineVisible={routeLineVisible} onToggleRouteLine={() => setRouteLineVisible(v => !v)}
          serviceMode={serviceMode}          onSetServiceMode={setServiceMode}
          viewMode={viewMode}               onToggleViewMode={() => setViewMode(v => v === 'live' ? 'static' : 'live')}
          heatmapVisible={heatmapVisible}   onToggleHeatmap={handleToggleHeatmap}
        />

        {appMode === 'tube' && <StrikeTicker notices={strikeNotices} />}

        {/* Transition overlay — fades in on route change, out once geometry is ready */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 500,
          background: mapBg,
          opacity: transitioning ? 1 : 0,
          transition: transitioning ? 'opacity 0.12s ease' : 'opacity 0.4s ease',
          pointerEvents: 'none',
        }} />

        <DebugTimestamp lastUpdated={lastUpdated} />
      </div>

      {/* Landing overlay — sits on top, fades out on tap */}
      {landingPhase !== 'done' && (
        <Landing
          phase={landingPhase}
          onTap={() => {
            setLandingPhase('spinning')
            setTimeout(() => setLandingPhase('fading'), 1800)
          }}
          onFadeEnd={() => setLandingPhase('done')}
        />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  appWrapper: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', width: '100vw', overflow: 'hidden',
  },

  mapWrapper: { flex: 1, position: 'relative' },

  // ── Digital clock ──────────────────────────────────────────────────────────

  rightColumn: {
    position: 'absolute', top: 20, right: 20, zIndex: 1000,
    display: 'flex', flexDirection: 'column', gap: 12,
    pointerEvents: 'none',
    alignItems: 'flex-end',
  },

  clock: {
    background: '#0d0d0d',
    borderRadius: 16, padding: '14px 20px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    textAlign: 'right',
    minWidth: 160,
  },
  clockNight: {
    background: '#0a0a1a',
    boxShadow: '0 4px 24px rgba(168,85,247,0.2), 0 2px 8px rgba(0,0,0,0.6)',
  },
  clockTimeRow: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 3,
  },
  clockHHMM: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 52, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1,
    color: '#ffffff',
  },
  clockSS: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 22, fontWeight: 400, letterSpacing: '-1px', lineHeight: 1,
    color: 'rgba(255,255,255,0.45)',
  },
  clockDivider: {
    height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0 8px',
  },
  clockLabel: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 4,
  },
  clockHours: {
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 16, fontWeight: 500, letterSpacing: '0.02em',
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Tube status chip ───────────────────────────────────────────────────────

  tubeChip: {
    background: '#0d0d0d', borderRadius: 14, padding: '12px 16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
    minWidth: 200,
  },
  tubeChipTitle: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 8,
  },
  tubeLineRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0',
  },
  tubeLineDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
  },
  tubeLineName: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter, system-ui, sans-serif', flex: 1,
  },
  tubeLineStatus: {
    fontSize: 11, fontWeight: 500,
    fontFamily: 'Inter, system-ui, sans-serif',
    textAlign: 'right', flexShrink: 0,
  },

  // ── Night badge ────────────────────────────────────────────────────────────

  nightBadge: {
    background: '#a855f7',
    color: '#fff',
    fontSize: 12, fontWeight: 700,
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: 8, padding: '2px 8px',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },

  replacementBadge: {
    background: '#f59e0b',
    color: '#000',
    fontSize: 12, fontWeight: 700,
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: 8, padding: '2px 8px',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },

  // ── Destination blind ──────────────────────────────────────────────────────

  blindFloatRow: {
    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
    zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8,
    pointerEvents: 'none',
  },

  blindPill: {
    background: '#0d0d0d', borderRadius: 18, padding: 6,
    display: 'flex', alignItems: 'center', gap: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)', pointerEvents: 'auto',
  },

  blindDestinationSection: {
    background: '#1e1e1e', borderRadius: 12, padding: '11px 22px',
    display: 'flex', alignItems: 'center',
  },
  blindDestinationText: {
    color: '#ffffff', fontSize: 22, fontWeight: 700,
    letterSpacing: '-0.4px', lineHeight: '28px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },

  blindRouteSection: {
    background: '#1e1e1e', borderRadius: 12, padding: '11px 18px',
    display: 'flex', alignItems: 'center', gap: 10,
    cursor: 'pointer', userSelect: 'none',
  },
  blindRouteText: {
    color: '#ffffff', fontSize: 22, fontWeight: 700,
    letterSpacing: '-0.4px', lineHeight: '28px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  blindArrow: {
    color: '#ffffff', fontSize: 15, lineHeight: 1, opacity: 0.8,
  },

  // ── Dropdown ───────────────────────────────────────────────────────────────

  dropdownPanel: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    background: '#0d0d0d', borderRadius: 16, padding: 6,
    minWidth: 260, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', zIndex: 2000,
  },
  dropdownOption: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', borderRadius: 10, cursor: 'pointer', userSelect: 'none',
    transition: 'background 0.1s',
  },
  dropdownOptionLabel: {
    color: '#fff', fontSize: 16, fontWeight: 700,
    fontFamily: 'Inter, system-ui, sans-serif', flex: 1,
  },
  dropdownRouteNumber: {
    color: '#fff', fontSize: 16, fontWeight: 700,
    fontFamily: 'Inter, system-ui, sans-serif', minWidth: 28,
  },
  dropdownRouteDest: {
    color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: 400,
    fontFamily: 'Inter, system-ui, sans-serif', flex: 1,
  },
  dropdownCheck: {
    color: 'rgba(255,255,255,0.8)', fontSize: 13,
    fontFamily: 'Inter, system-ui, sans-serif', marginLeft: 'auto', flexShrink: 0,
  },
  dropdownDivider: {
    height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 8px',
  },

  // Shows 5 routes at a time; scrolls to reveal the rest
  dropdownScroll: {
    maxHeight: 220, // ~44px per option × 5
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  // ── Route facts chip ──────────────────────────────────────────────────────

  factChip: {
    position: 'absolute', top: 20, left: 20, zIndex: 1000,
    background: '#0d0d0d', borderRadius: 14, padding: '12px 16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)', pointerEvents: 'none',
    minWidth: 180, maxWidth: 220,
  },
  factTitle: {
    fontSize: 13, fontWeight: 700, color: '#fff',
    fontFamily: 'Inter, system-ui, sans-serif',
    letterSpacing: '-0.2px', marginBottom: 8,
  },
  factDivider: {
    height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0',
  },
  factGrid: {
    display: 'flex', flexDirection: 'column', gap: 5,
  },
  factRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
  },
  factLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  factValue: {
    fontSize: 13, fontWeight: 600, color: '#fff',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    letterSpacing: '-0.3px',
  },
  factLandmarkLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 5,
  },
  factLandmark: {
    fontSize: 12, color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Inter, system-ui, sans-serif',
    lineHeight: 1.5,
  },

  heatmapNoDataNote: {
    marginTop: 8, paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    fontSize: 11, color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter, system-ui, sans-serif',
    lineHeight: 1.4,
  },

  // ── Bunching legend ────────────────────────────────────────────────────────

  legend: {
    position: 'absolute', bottom: 20, left: 20, zIndex: 1000,
    background: '#0d0d0d', borderRadius: 12, padding: '10px 14px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)', pointerEvents: 'none',
    minWidth: 152,
  },
  legendTitle: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
    marginBottom: 8, fontFamily: 'Inter, system-ui, sans-serif',
  },
  legendRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  legendText: {
    fontSize: 12, color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  legendDotRed: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#e63946', flexShrink: 0, display: 'inline-block',
  },
  legendPulseLine: {
    width: 24, height: 3, borderRadius: 2,
    background: 'linear-gradient(90deg, transparent, #e63946, transparent)',
    flexShrink: 0,
  },
  legendBand: {
    width: 24, height: 8, borderRadius: 3,
    background: 'rgba(230,57,70,0.35)', flexShrink: 0,
  },

  // ── Icon controls ──────────────────────────────────────────────────────────

  controlsPanel: {
    position: 'absolute', bottom: 20, right: 20, zIndex: 1000,
    display: 'flex', gap: 8, pointerEvents: 'auto',
  },

  // ── Debug timestamp ────────────────────────────────────────────────────────

  timestampPill: {
    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
    zIndex: 1000, background: '#0d0d0d', borderRadius: 12, padding: '8px 16px',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'ui-monospace, "SF Mono", "Fira Code", Menlo, monospace',
    fontSize: 12, letterSpacing: '0.04em',
    pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
  },

  // ── Popup ──────────────────────────────────────────────────────────────────

  popup: { minWidth: 190 },
  popupBunching: {
    fontSize: 11, fontWeight: 600, color: '#e63946',
    marginBottom: 6, letterSpacing: '0.03em',
  },
  popupRoute: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#e67300', marginBottom: 4,
  },
  popupDestination: {
    fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 12, lineHeight: 1.3,
  },
  popupDetail: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16,
    marginBottom: 5, fontSize: 13,
  },
  popupLabel: { color: '#888', fontWeight: 400 },
  popupValue: { color: '#1a1a1a', fontWeight: 500 },
  popupVehicle: {
    marginTop: 10, paddingTop: 10, borderTop: '1px solid #ebebeb',
    fontSize: 12, color: '#aaa', fontVariantNumeric: 'tabular-nums',
  },

  // ── Controls divider ───────────────────────────────────────────────────────

  controlsDivider: {
    width: 1, height: 28, background: 'rgba(0,0,0,0.12)', flexShrink: 0, alignSelf: 'center',
  },

  // ── Tube mode blind (roundel) ──────────────────────────────────────────────

  tubeRoundel: {
    width: 36, height: 36, borderRadius: '50%',
    border: '4px solid #E32017', background: '#003399',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, position: 'relative', overflow: 'hidden',
  },
  tubeRoundelBar: {
    position: 'absolute', left: -4, right: -4, height: 10,
    background: '#E32017',
  },

  // ── Strike ticker ──────────────────────────────────────────────────────────

  tickerContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
    background: '#0d0d0d',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '7px 16px',
    display: 'flex', alignItems: 'center', gap: 14,
    overflow: 'hidden',
    pointerEvents: 'none',
    height: 34,
  },
  tickerLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    fontFamily: 'Inter, system-ui, sans-serif',
    flexShrink: 0, userSelect: 'none',
  },
  tickerTrack: {
    flex: 1, overflow: 'hidden', position: 'relative',
  },
  tickerText: {
    fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif',
    letterSpacing: '0.01em',
  },
}
