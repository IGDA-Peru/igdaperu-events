import { CalendarDays, ListFilter, MapPin, Monitor, Search, Users } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { departmentFilters, modalityFilters, timeFilters, type CommunityFilterOption, type ModalityFilter, type TimeFilter } from '../lib/eventFilters'

export function EventSearchField({ search, onSearchChange }: { search: string; onSearchChange: (value: string) => void }) {
  return <label className="search-field" title="Buscar eventos"><Search size={17} aria-hidden="true" /><span className="sr-only">Buscar eventos</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar" /></label>
}

type EventFilterProps = {
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
  showTimeFilter?: boolean
  showCommunityFilter?: boolean
}

function EventFilterControls({ timeFilter, modalityFilter = 'all', locationFilter, communityFilter = 'all', communityOptions = [], onTimeChange, onModalityChange, onLocationChange, onCommunityChange, showTimeFilter = true, showCommunityFilter = true }: Pick<EventFilterProps, 'timeFilter' | 'modalityFilter' | 'locationFilter' | 'communityFilter' | 'communityOptions' | 'onTimeChange' | 'onModalityChange' | 'onLocationChange' | 'onCommunityChange' | 'showTimeFilter' | 'showCommunityFilter'>) {
  const showLocation = modalityFilter === 'venue' || modalityFilter === 'hybrid'
  return <div className="filter-controls" aria-label="Filtrar eventos">
    {showTimeFilter && <label className="filter-control"><span className="filter-control-label"><CalendarDays size={14} aria-hidden="true" /> Tiempo</span><select aria-label="Tiempo" value={timeFilter} onChange={(event) => onTimeChange(event.target.value as TimeFilter)}>{timeFilters.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>}
    {onModalityChange && <label className="filter-control"><span className="filter-control-label"><Monitor size={14} aria-hidden="true" /> Modalidad</span><select aria-label="Modalidad" value={modalityFilter} onChange={(event) => onModalityChange(event.target.value as ModalityFilter)}>{modalityFilters.map((modality) => <option value={modality.value} key={modality.value}>{modality.label}</option>)}</select></label>}
    {showLocation && <label className="filter-control"><span className="filter-control-label"><MapPin size={14} aria-hidden="true" /> Lugar</span><select aria-label="Lugar" value={locationFilter} onChange={(event) => onLocationChange(event.target.value)}><option value="all">Todos</option><option value="Perú">Perú</option><optgroup label="Departamentos del Perú">{departmentFilters.map((department) => <option value={department.value} key={department.value}>{department.label}</option>)}</optgroup><option value="Internacional">Internacional</option></select></label>}
    {showCommunityFilter && communityOptions.length > 0 && onCommunityChange && <label className="filter-control"><span className="filter-control-label"><Users size={14} aria-hidden="true" /> Comunidad</span><select aria-label="Comunidad" value={communityFilter} onChange={(event) => onCommunityChange(event.target.value)}><option value="all">Todas</option>{communityOptions.map((community) => <option value={community.value} key={community.value}>{community.label}</option>)}</select></label>}
  </div>
}

export function EventFilters({ timeFilter, modalityFilter = 'all', locationFilter, communityFilter = 'all', communityOptions = [], search, onTimeChange, onModalityChange, onLocationChange, onCommunityChange, onSearchChange, showSearch = true, showTimeFilter = true, showCommunityFilter = true }: EventFilterProps) {
  return <div className="events-toolbar">
    <EventFilterControls timeFilter={timeFilter} modalityFilter={modalityFilter} locationFilter={locationFilter} communityFilter={communityFilter} communityOptions={communityOptions} onTimeChange={onTimeChange} onModalityChange={onModalityChange} onLocationChange={onLocationChange} onCommunityChange={onCommunityChange} showTimeFilter={showTimeFilter} showCommunityFilter={showCommunityFilter} />
    {showSearch && <EventSearchField search={search} onSearchChange={onSearchChange} />}
  </div>
}

export function EventFiltersPopover({ timeFilter, modalityFilter = 'all', locationFilter, communityFilter = 'all', communityOptions = [], onTimeChange, onModalityChange, onLocationChange, onCommunityChange, onClear, showTimeFilter = true, showCommunityFilter = true }: Omit<EventFilterProps, 'search' | 'onSearchChange' | 'showSearch'> & { onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  const activeFilterCount = [timeFilter !== 'all', modalityFilter !== 'all', locationFilter !== 'all', communityFilter !== 'all'].filter(Boolean).length
  const activeFilterLabel = activeFilterCount === 1 ? '1 filtro activo' : `${activeFilterCount} filtros activos`

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return <div className="event-filter-popover-wrap" ref={popoverRef}>
    <button className={`filter-button event-filter-trigger${activeFilterCount ? ' selected' : ''}`} type="button" title="Filtros" aria-label={activeFilterCount ? `Filtros, ${activeFilterLabel}` : 'Filtros'} aria-haspopup="dialog" aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen((current) => !current)}>
      <ListFilter size={16} aria-hidden="true" />
      <span>Filtros</span>
      {activeFilterCount > 0 && <span className="filter-count" aria-hidden="true">{activeFilterCount}</span>}
    </button>
    {open && <div className="event-filter-popover" id={popoverId} role="dialog" aria-label="Filtros de eventos">
      <div className="event-filter-popover-header">
        <div><strong>Filtrar eventos</strong></div>
        <button className="event-filter-clear" type="button" onClick={onClear} disabled={!activeFilterCount}>Limpiar</button>
      </div>
      <EventFilterControls timeFilter={timeFilter} modalityFilter={modalityFilter} locationFilter={locationFilter} communityFilter={communityFilter} communityOptions={communityOptions} onTimeChange={onTimeChange} onModalityChange={onModalityChange} onLocationChange={onLocationChange} onCommunityChange={onCommunityChange} showTimeFilter={showTimeFilter} showCommunityFilter={showCommunityFilter} />
    </div>}
  </div>
}
