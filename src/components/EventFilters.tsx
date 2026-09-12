import { CalendarDays, MapPin, Search, Users } from 'lucide-react'
import { locationFilters, timeFilters, type CommunityFilterOption, type TimeFilter } from '../lib/eventFilters'

export function EventSearchField({ search, onSearchChange }: { search: string; onSearchChange: (value: string) => void }) {
  return <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar eventos</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar" /></label>
}

export function EventFilters({ timeFilter, locationFilter, communityFilter = 'all', communityOptions = [], search, onTimeChange, onLocationChange, onCommunityChange, onSearchChange, showSearch = true }: {
  timeFilter: TimeFilter
  locationFilter: string
  communityFilter?: string
  communityOptions?: CommunityFilterOption[]
  search: string
  onTimeChange: (value: TimeFilter) => void
  onLocationChange: (value: string) => void
  onCommunityChange?: (value: string) => void
  onSearchChange: (value: string) => void
  showSearch?: boolean
}) {
  return <div className="events-toolbar">
    <div className="filter-controls" aria-label="Filtrar eventos">
      <label className="filter-control"><span className="filter-control-label"><CalendarDays size={14} aria-hidden="true" /> Tiempo</span><select aria-label="Tiempo" value={timeFilter} onChange={(event) => onTimeChange(event.target.value as TimeFilter)}>{timeFilters.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <label className="filter-control"><span className="filter-control-label"><MapPin size={14} aria-hidden="true" /> Lugar</span><select aria-label="Lugar" value={locationFilter} onChange={(event) => onLocationChange(event.target.value)}>{locationFilters.map((location) => <option value={location === 'Todos' ? 'all' : location} key={location}>{location}</option>)}</select></label>
      {communityOptions.length > 0 && onCommunityChange && <label className="filter-control"><span className="filter-control-label"><Users size={14} aria-hidden="true" /> Comunidad</span><select aria-label="Comunidad" value={communityFilter} onChange={(event) => onCommunityChange(event.target.value)}><option value="all">Todas</option>{communityOptions.map((community) => <option value={community.value} key={community.value}>{community.label}</option>)}</select></label>}
    </div>
    {showSearch && <EventSearchField search={search} onSearchChange={onSearchChange} />}
  </div>
}
