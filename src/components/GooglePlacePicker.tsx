import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { CircleAlert, LocateFixed, MapPin, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type PlaceSelection = {
  placeId: string
  formattedAddress: string
  venueName: string
  address: string
  latitude: number
  longitude: number
  mapUrl: string
}

type GooglePlacePickerProps = {
  address: string
  latitude: number | null
  longitude: number | null
  venueName: string
  onChange: (selection: PlaceSelection) => void
  onManualAddressChange?: (address: string) => void
}

const googleMapsLoaderState = globalThis as typeof globalThis & { __igdaperuMapsLoaderConfigured?: boolean }

function mapUrlFor(selection: Pick<PlaceSelection, 'placeId' | 'venueName' | 'address' | 'latitude' | 'longitude'>) {
  const query = selection.address || selection.venueName || `${selection.latitude},${selection.longitude}`
  const placeQuery = selection.placeId ? `&query_place_id=${encodeURIComponent(selection.placeId)}` : ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${placeQuery}`
}

function coordinatesFor(location: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined) {
  if (!location) return null
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng
  return { latitude: lat, longitude: lng }
}

export function GooglePlacePicker({ address, latitude, longitude, venueName, onChange, onManualAddressChange }: GooglePlacePickerProps) {
  const searchRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; address: string } | null>(null)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
  const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
  const latestPropsRef = useRef({ address, venueName, onChange })
  const initialLocationRef = useRef({ latitude, longitude })

  useEffect(() => {
    latestPropsRef.current = { address, venueName, onChange }
  }, [address, venueName, onChange])

  useEffect(() => {
    if (!apiKey || !searchRef.current || !mapRef.current) return
    const searchElement = searchRef.current
    const mapElement = mapRef.current
    let cancelled = false
    let createdMarker: google.maps.marker.AdvancedMarkerElement | null = null

    async function loadMap() {
      try {
        if (!googleMapsLoaderState.__igdaperuMapsLoaderConfigured) {
          setOptions({ key: apiKey, v: 'weekly', language: 'es', region: 'PE' })
          googleMapsLoaderState.__igdaperuMapsLoaderConfigured = true
        }
        const [{ Map }, { AdvancedMarkerElement }, { PlaceAutocompleteElement }] = await Promise.all([
          importLibrary('maps'),
          importLibrary('marker'),
          importLibrary('places'),
        ])
        if (cancelled) return

        const initialCenter = initialLocationRef.current.latitude !== null && initialLocationRef.current.longitude !== null ? { lat: initialLocationRef.current.latitude, lng: initialLocationRef.current.longitude } : { lat: -12.0464, lng: -77.0428 }
        const map = new Map(mapElement, {
          center: initialCenter,
          zoom: initialLocationRef.current.latitude !== null && initialLocationRef.current.longitude !== null ? 16 : 12,
          mapId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        const marker = new AdvancedMarkerElement({
          map,
          position: initialLocationRef.current.latitude !== null && initialLocationRef.current.longitude !== null ? initialCenter : undefined,
          gmpDraggable: true,
          title: 'Ubicación del evento',
        })
        createdMarker = marker
        const autocomplete = new PlaceAutocompleteElement()
        autocomplete.placeholder = 'Busca un lugar o dirección'
        autocomplete.setAttribute('aria-label', 'Buscar lugar o dirección')
        autocomplete.includedRegionCodes = ['pe']
        autocomplete.includedPrimaryTypes = ['establishment', 'geocode']
        searchElement.replaceChildren(autocomplete)
        mapInstanceRef.current = map
        markerRef.current = marker

        autocomplete.addEventListener('gmp-select', async (event: Event) => {
          const selectionEvent = event as unknown as { placePrediction?: google.maps.places.PlacePrediction }
          const prediction = selectionEvent.placePrediction
          if (!prediction) return
          try {
            const place = prediction.toPlace()
            await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'] })
            const coordinates = coordinatesFor(place.location)
            if (!coordinates) return
            const next = {
              placeId: place.id || '',
              formattedAddress: place.formattedAddress || '',
              venueName: place.displayName || '',
              address: place.formattedAddress || '',
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              mapUrl: mapUrlFor({ placeId: place.id || '', venueName: place.displayName || '', address: place.formattedAddress || '', latitude: coordinates.latitude, longitude: coordinates.longitude }),
            }
            marker.position = { lat: coordinates.latitude, lng: coordinates.longitude }
            if (place.viewport) map.fitBounds(place.viewport)
            else { map.setCenter({ lat: coordinates.latitude, lng: coordinates.longitude }); map.setZoom(16) }
            setSelectedPlace({ name: place.displayName || 'Lugar seleccionado', address: place.formattedAddress || '' })
            setMessage('Lugar seleccionado. Puedes mover el pin para ajustar la ubicación.')
            latestPropsRef.current.onChange(next)
          } catch {
            setMessage('No pudimos cargar ese lugar. Puedes probar con otra búsqueda o completar la dirección manualmente.')
          }
        })

        marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
          const coordinates = coordinatesFor(event.latLng)
          if (!coordinates) return
          const current = latestPropsRef.current
          const next = { placeId: '', formattedAddress: current.address, venueName: current.venueName, address: current.address, latitude: coordinates.latitude, longitude: coordinates.longitude, mapUrl: mapUrlFor({ placeId: '', venueName: current.venueName, address: current.address, latitude: coordinates.latitude, longitude: coordinates.longitude }) }
          setMessage('Pin ajustado. Revisa la dirección antes de guardar.')
          latestPropsRef.current.onChange(next)
        })

        setState('ready')
      } catch {
        if (!cancelled) {
          setState('error')
          setMessage('No pudimos cargar Google Maps. Puedes completar el lugar y la dirección manualmente.')
        }
      }
    }

    void loadMap()
    return () => {
      cancelled = true
      if (createdMarker) createdMarker.map = null
      markerRef.current = null
      mapInstanceRef.current = null
      searchElement.replaceChildren()
    }
  }, [apiKey, mapId])

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return
    if (latitude === null || longitude === null) {
      markerRef.current.position = null
      return
    }
    const position = { lat: latitude, lng: longitude }
    markerRef.current.position = position
    mapInstanceRef.current.setCenter(position)
    mapInstanceRef.current.setZoom(16)
  }, [latitude, longitude])

  const toggleManualMode = () => {
    setManualMode((current) => !current)
    setMessage('')
  }

  if (!apiKey) return <div className="google-place-picker google-place-picker-manual" data-state="manual">
    <div className="map-picker-manual-input"><input aria-label="Buscar lugar o dirección" value={address} onChange={(event) => onManualAddressChange?.(event.target.value)} placeholder="Av. / calle, distrito, ciudad" /><span className="field-help">La búsqueda de Google Maps aparecerá cuando se configure la clave del proyecto.</span></div>
    <div className="map-picker-unavailable"><MapPin size={19} aria-hidden="true" /><div><strong>Mapa pendiente de configuración</strong><p>Al activar Google Maps verás las sugerencias y el pin aquí. Por ahora puedes completar la dirección manualmente.</p></div></div>
  </div>

  return <div className="google-place-picker-shell">
    <div className="google-place-picker" data-state={state}>
      <div className={`map-picker-search ${manualMode ? 'is-hidden' : ''}`} ref={searchRef} aria-label="Buscar lugar o dirección" />
      {manualMode && <div className="map-picker-manual-input"><input aria-label="Dirección manual" value={address} onChange={(event) => { setSelectedPlace(null); onManualAddressChange?.(event.target.value) }} placeholder="Av. / calle, distrito, ciudad" /><span className="field-help">Usa esta opción si el lugar no aparece en las sugerencias.</span></div>}
      {selectedPlace && <div className="map-picker-selection"><MapPin size={17} aria-hidden="true" /><span><strong>{selectedPlace.name}</strong><small>{selectedPlace.address}</small></span></div>}
      <div className="map-picker-canvas" aria-label="Mapa para seleccionar la ubicación" role="application">
        <div className="map-picker-map" ref={mapRef} aria-hidden="true" />
        {state === 'loading' && <div className="map-picker-loading"><RotateCcw className="spin" size={18} aria-hidden="true" /> Cargando mapa…</div>}
        {state === 'error' && <div className="map-picker-loading"><LocateFixed size={18} aria-hidden="true" /> Mapa no disponible</div>}
      </div>
    </div>
    <button className="map-picker-mode-button" type="button" onClick={toggleManualMode}>{manualMode ? 'Volver a buscar en Google Maps' : <><CircleAlert size={15} aria-hidden="true" /> No encuentro el lugar · Ingresar manualmente</>}</button>
    {message && <p className="field-help map-picker-message" role={state === 'error' ? 'alert' : undefined}>{message}</p>}
  </div>
}
