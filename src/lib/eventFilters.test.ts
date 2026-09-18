import { describe, expect, it } from 'vitest'
import { demoEvents } from './demo-data'
import { matchesLocationFilter } from './eventFilters'

describe('matchesLocationFilter', () => {
  it('matches general department and province locations', () => {
    expect(matchesLocationFilter({ ...demoEvents[0], locationDepartment: 'Lima', locationProvince: '' }, 'Lima')).toBe(true)
    expect(matchesLocationFilter({ ...demoEvents[0], locationDepartment: 'Cusco', locationProvince: 'Cusco' }, 'Cusco')).toBe(true)
  })

  it('reads a Google formatted address and assigns it to its department', () => {
    const event = { ...demoEvents[0], locationDepartment: '', locationProvince: '', venueName: 'Centro Cultural', address: '', formattedAddress: 'Av. Arequipa 123, Miraflores, Lima, Perú' }
    expect(matchesLocationFilter(event, 'Lima')).toBe(true)
    expect(matchesLocationFilter(event, 'Perú')).toBe(true)
    expect(matchesLocationFilter(event, 'Internacional')).toBe(false)
  })

  it('recognizes Lima from a district and postal code in an exact address', () => {
    const event = { ...demoEvents[0], locationDepartment: '', locationProvince: '', venueName: 'Centro Cultural Ricardo Palma', address: '', formattedAddress: 'Av. José Larco 770, Miraflores 15074' }
    expect(matchesLocationFilter(event, 'Lima')).toBe(true)
    expect(matchesLocationFilter(event, 'Perú')).toBe(true)
    expect(matchesLocationFilter(event, 'Internacional')).toBe(false)
  })

  it('maps a Google address that only contains a Peruvian province', () => {
    const event = { ...demoEvents[0], locationDepartment: '', locationProvince: '', venueName: '', address: 'Chiclayo, Perú', formattedAddress: '' }
    expect(matchesLocationFilter(event, 'Lambayeque')).toBe(true)
    expect(matchesLocationFilter(event, 'Perú')).toBe(true)
  })

  it('prefers the administrative city over a street named after another department', () => {
    const event = { ...demoEvents[0], locationDepartment: '', locationProvince: '', venueName: '', address: '', formattedAddress: 'Av. Arequipa 123, Chiclayo, Perú' }
    expect(matchesLocationFilter(event, 'Lambayeque')).toBe(true)
    expect(matchesLocationFilter(event, 'Arequipa')).toBe(false)
  })

  it('reads legacy/manual address fields and encoded map URLs', () => {
    const manualEvent = { ...demoEvents[0], locationDepartment: '', locationProvince: '', venueName: '', address: 'Jr. Lima 123, Perú', formattedAddress: '', mapUrl: '' }
    const mapEvent = { ...demoEvents[0], locationDepartment: '', locationProvince: '', venueName: '', address: '', formattedAddress: '', mapUrl: 'https://www.google.com/maps/search/?query=Arequipa%2C%20Per%C3%BA' }
    expect(matchesLocationFilter(manualEvent, 'Lima')).toBe(true)
    expect(matchesLocationFilter(mapEvent, 'Arequipa')).toBe(true)
  })

  it('does not match a department as an accidental substring', () => {
    const event = { ...demoEvents[0], locationDepartment: '', locationProvince: '', venueName: '', address: 'República de Perú', formattedAddress: '' }
    expect(matchesLocationFilter(event, 'Ica')).toBe(false)
    expect(matchesLocationFilter(event, 'Perú')).toBe(true)
  })
})
