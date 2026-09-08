import { act, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GooglePlacePicker } from './GooglePlacePicker'

const maps = vi.hoisted(() => {
  let dragEndListener: ((event: { latLng: { lat: () => number; lng: () => number } }) => void) | undefined
  const geocode = vi.fn()

  class MockMap {
    addListener() {
      return { remove: vi.fn() }
    }

    fitBounds() {}
    setCenter() {}
    setZoom() {}
  }

  class MockMarker {
    map: unknown
    position: unknown

    constructor(options: { map?: unknown; position?: unknown }) {
      this.map = options.map
      this.position = options.position
    }

    addListener(eventName: string, listener: (event: { latLng: { lat: () => number; lng: () => number } }) => void) {
      if (eventName === 'dragend') dragEndListener = listener
      return { remove: vi.fn() }
    }
  }

  class MockAutocomplete extends HTMLElement {
    includedRegionCodes: string[] = []
    includedPrimaryTypes: string[] = []
  }

  customElements.define('mock-place-autocomplete', MockAutocomplete)

  class MockGeocoder {
    geocode = geocode
  }

  return {
    MockAutocomplete,
    MockGeocoder,
    MockMap,
    MockMarker,
    geocode,
    triggerDragEnd(event: { latLng: { lat: () => number; lng: () => number } }) {
      dragEndListener?.(event)
    },
  }
})

vi.mock('@googlemaps/js-api-loader', () => ({
  importLibrary: vi.fn(async (library: string) => {
    if (library === 'maps') return { Map: maps.MockMap }
    if (library === 'marker') return { AdvancedMarkerElement: maps.MockMarker }
    if (library === 'places') return { PlaceAutocompleteElement: maps.MockAutocomplete }
    return { Geocoder: maps.MockGeocoder }
  }),
  setOptions: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  delete (globalThis as typeof globalThis & { __igdaperuMapsLoaderConfigured?: boolean }).__igdaperuMapsLoaderConfigured
})

it('updates the address after dragging the map pin', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', 'test-key')
  maps.geocode.mockResolvedValue({ results: [{ place_id: 'place-1', formatted_address: 'Av. Arequipa 123, Lima, Perú' }] })
  const onChange = vi.fn()

  render(<GooglePlacePicker address="" latitude={null} longitude={null} venueName="" onChange={onChange} />)

  await waitFor(() => expect(document.querySelector('[data-state="ready"]')).toBeInTheDocument())
  await act(async () => {
    maps.triggerDragEnd({ latLng: { lat: () => -12.091, lng: () => -77.024 } })
  })

  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
    placeId: 'place-1',
    address: 'Av. Arequipa 123, Lima, Perú',
    formattedAddress: 'Av. Arequipa 123, Lima, Perú',
    latitude: -12.091,
    longitude: -77.024,
  })))
})
