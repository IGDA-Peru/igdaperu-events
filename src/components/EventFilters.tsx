import { CalendarDays, MapPin, Monitor, Search, Users } from 'lucide-react'
import { departmentFilters, modalityFilters, timeFilters, type CommunityFilterOption, type ModalityFilter, type TimeFilter } from '../lib/eventFilters'

export function EventSearchField({ search, onSearchChange }: { search: string; onSearchChange: (value: string) => void }) {
  return <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar eventos</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar" /></label>
}

export function EventFilters({ timeFilter, modalityFilter = 'all', locationFilter, communityFilter = 'all', communityOptions = [], search, onTimeChange, onModalityChange, onLocationChange, onCommunityChange, onSearchChange, showSearch = true }: {
  timeFilter: TimeFilter
  modalityFilter?: ModalityFilter
  locationFilter: string
  communityFilter?: string
  communityOptions?: CommunityFilterOption[]
  search: string
  onTimeChange: (value: TimeFilter) => void
  onModalityChange?: (value: ModalityFilter) => void
  onLocationChange: (value: string) => void
  onCommunityChange?: (value: string) => void
  onSearchChange: (value: string) => void
  showSearch?: boolean
}) {
  const showLocation = modalityFilter === 'venue' || modalityFilter === 'hybrid'
  return <div className="events-toolbar">
    <div className="filter-controls" aria-label="Filtrar eventos">
      <label className="filter-control"><span className="filter-control-label"><CalendarDays size={14} aria-hidden="true" /> Tiempo</span><select aria-label="Tiempo" value={timeFilter} onChange={(event) => onTimeChange(event.target.value as TimeFilter)}>{timeFilters.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      {onModalityChange && <label className="filter-control"><span className="filter-control-label"><Monitor size={14} aria-hidden="true" /> Modalidad</span><select aria-label="Modalidad" value={modalityFilter} onChange={(event) => onModalityChange(event.target.value as ModalityFilter)}>{modalityFilters.map((modality) => <option value={modality.value} key={modality.value}>{modality.label}</option>)}</select></label>}
      {showLocation && <label className="filter-control"><span className="filter-control-label"><MapPin size={14} aria-hidden="true" /> Lugar</span><select aria-label="Lugar" value={locationFilter} onChange={(event) => onLocationChange(event.target.value)}><option value="all">Todos</option><option value="Perú">Perú</option><optgroup label="Departamentos del Perú">{departmentFilters.map((department) => <option value={department.value} key={department.value}>{department.label}</option>)}</optgroup><option value="Internacional">Internacional</option></select></label>}
      {communityOptions.length > 0 && onCommunityChange && <label className="filter-control"><span className="filter-control-label"><Users size={14} aria-hidden="true" /> Comunidad</span><select aria-label="Comunidad" value={communityFilter} onChange={(event) => onCommunityChange(event.target.value)}><option value="all">Todas</option>{communityOptions.map((community) => <option value={community.value} key={community.value}>{community.label}</option>)}</select></label>}
    </div>
    {showSearch && <EventSearchField search={search} onSearchChange={onSearchChange} />}
  </div>
}
