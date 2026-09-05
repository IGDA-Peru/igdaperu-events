import { CalendarDays, MapPin, Search } from 'lucide-react'
import { locationFilters, timeFilters, type TimeFilter } from '../lib/eventFilters'

export function EventFilters({ timeFilter, locationFilter, search, onTimeChange, onLocationChange, onSearchChange }: {
  timeFilter: TimeFilter
  locationFilter: string
  search: string
  onTimeChange: (value: TimeFilter) => void
  onLocationChange: (value: string) => void
  onSearchChange: (value: string) => void
}) {
  return <div className="events-toolbar">
    <div className="filter-controls" aria-label="Filtrar eventos">
      <label className="filter-control"><span className="filter-control-label"><CalendarDays size={14} aria-hidden="true" /> Tiempo</span><select aria-label="Tiempo" value={timeFilter} onChange={(event) => onTimeChange(event.target.value as TimeFilter)}>{timeFilters.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <label className="filter-control"><span className="filter-control-label"><MapPin size={14} aria-hidden="true" /> Lugar</span><select aria-label="Lugar" value={locationFilter} onChange={(event) => onLocationChange(event.target.value)}>{locationFilters.map((location) => <option value={location === 'Todos' ? 'all' : location} key={location}>{location}</option>)}</select></label>
    </div>
    <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar eventos</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar" /></label>
  </div>
}
