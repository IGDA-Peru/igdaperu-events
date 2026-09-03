import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { LocateFixed, MapPin, RotateCcw } from 'lucide-react'
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
}

let mapsLoaderConfigured = false

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

export function GooglePlacePicker({ address, latitude, longitude, venueName, onChange }: GooglePlacePickerProps) {
  const searchRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
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
        if (!mapsLoaderConfigured) {
          setOptions({ key: apiKey, v: 'weekly', language: 'es', region: 'PE' })
          mapsLoaderConfigured = true
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
          mapId: 'DEMO_MAP_ID',
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
  }, [apiKey])

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || latitude === null || longitude === null) return
    const position = { lat: latitude, lng: longitude }
    markerRef.current.position = position
    mapInstanceRef.current.setCenter(position)
    mapInstanceRef.current.setZoom(16)
  }, [latitude, longitude])

  if (!apiKey) return <div className="map-picker-unavailable"><MapPin size={19} aria-hidden="true" /><div><strong>Selector de mapa pendiente de configuración</strong><p>Completa el lugar manualmente o usa el enlace de Google Maps. El mapa interactivo aparecerá cuando se configure la clave del proyecto.</p></div></div>

  return <div className="google-place-picker" data-state={state}>
    <div className="map-picker-search" ref={searchRef} aria-label="Buscar ubicación" />
    <div className="map-picker-canvas" ref={mapRef} aria-label="Mapa para seleccionar la ubicación" role="application">
      {state === 'loading' && <div className="map-picker-loading"><RotateCcw className="spin" size={18} aria-hidden="true" /> Cargando mapa…</div>}
      {state === 'error' && <div className="map-picker-loading"><LocateFixed size={18} aria-hidden="true" /> Mapa no disponible</div>}
    </div>
    {message && <p className="field-help map-picker-message" role={state === 'error' ? 'alert' : undefined}>{message}</p>}
  </div>
}
