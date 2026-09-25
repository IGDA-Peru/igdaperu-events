import { CalendarDays, ListFilter, MapPin, Monitor, Search, Users } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { departmentFilters, modalityFilters, timeFilters, type CommunityFilterOption, type ModalityFilter, type TimeFilter } from '../lib/eventFilters'
import { useLocale } from '../i18n'

export function EventSearchField({ search, onSearchChange }: { search: string; onSearchChange: (value: string) => void }) {
  const { t } = useLocale()
  return <label className="search-field" title={t('filters.searchEvents')}><Search size={17} aria-hidden="true" /><span className="sr-only">{t('filters.searchEvents')}</span><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={t('filters.search')} /></label>
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
  const { t } = useLocale()
  const showLocation = modalityFilter === 'venue' || modalityFilter === 'hybrid'
  const modalityLabels: Record<ModalityFilter, string> = { all: t('filters.allCommunities'), venue: t('filters.venue'), online: t('filters.online'), hybrid: t('filters.hybrid') }
  const timeLabels: Record<TimeFilter, string> = { all: t('filters.all'), today: t('filters.today'), week: t('filters.week'), month: t('filters.month'), 'next-month': t('filters.nextMonth'), year: t('filters.year') }
  return <div className="filter-controls" aria-label={t('filters.events')}>
    {showTimeFilter && <label className="filter-control"><span className="filter-control-label"><CalendarDays size={14} aria-hidden="true" /> {t('filters.time')}</span><select aria-label={t('filters.time')} value={timeFilter} onChange={(event) => onTimeChange(event.target.value as TimeFilter)}>{timeFilters.map((item) => <option value={item.value} key={item.value}>{timeLabels[item.value]}</option>)}</select></label>}
    {onModalityChange && <label className="filter-control"><span className="filter-control-label"><Monitor size={14} aria-hidden="true" /> {t('filters.modality')}</span><select aria-label={t('filters.modality')} value={modalityFilter} onChange={(event) => onModalityChange(event.target.value as ModalityFilter)}>{modalityFilters.map((modality) => <option value={modality.value} key={modality.value}>{modalityLabels[modality.value]}</option>)}</select></label>}
    {showLocation && <label className="filter-control"><span className="filter-control-label"><MapPin size={14} aria-hidden="true" /> {t('filters.location')}</span><select aria-label={t('filters.location')} value={locationFilter} onChange={(event) => onLocationChange(event.target.value)}><option value="all">{t('filters.all')}</option><option value="Perú">Perú</option><optgroup label={t('filters.departments')}>{departmentFilters.map((department) => <option value={department.value} key={department.value}>{department.label}</option>)}</optgroup><option value="Internacional">{t('filters.international')}</option></select></label>}
    {showCommunityFilter && communityOptions.length > 0 && onCommunityChange && <label className="filter-control"><span className="filter-control-label"><Users size={14} aria-hidden="true" /> {t('filters.community')}</span><select aria-label={t('filters.community')} value={communityFilter} onChange={(event) => onCommunityChange(event.target.value)}><option value="all">{t('filters.allCommunities')}</option>{communityOptions.map((community) => <option value={community.value} key={community.value}>{community.label}</option>)}</select></label>}
  </div>
}

export function EventFilters({ timeFilter, modalityFilter = 'all', locationFilter, communityFilter = 'all', communityOptions = [], search, onTimeChange, onModalityChange, onLocationChange, onCommunityChange, onSearchChange, showSearch = true, showTimeFilter = true, showCommunityFilter = true }: EventFilterProps) {
  return <div className="events-toolbar">
    <EventFilterControls timeFilter={timeFilter} modalityFilter={modalityFilter} locationFilter={locationFilter} communityFilter={communityFilter} communityOptions={communityOptions} onTimeChange={onTimeChange} onModalityChange={onModalityChange} onLocationChange={onLocationChange} onCommunityChange={onCommunityChange} showTimeFilter={showTimeFilter} showCommunityFilter={showCommunityFilter} />
    {showSearch && <EventSearchField search={search} onSearchChange={onSearchChange} />}
  </div>
}

export function EventFiltersPopover({ timeFilter, modalityFilter = 'all', locationFilter, communityFilter = 'all', communityOptions = [], onTimeChange, onModalityChange, onLocationChange, onCommunityChange, onClear, showTimeFilter = true, showCommunityFilter = true }: Omit<EventFilterProps, 'search' | 'onSearchChange' | 'showSearch'> & { onClear: () => void }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  const activeFilterCount = [timeFilter !== 'all', modalityFilter !== 'all', locationFilter !== 'all', communityFilter !== 'all'].filter(Boolean).length
  const activeFilterLabel = activeFilterCount === 1 ? t('filters.activeOne') : t('filters.activeMany', { count: String(activeFilterCount) })

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
    <button className={`filter-button event-filter-trigger${activeFilterCount ? ' selected' : ''}`} type="button" title={t('filters.filters')} aria-label={activeFilterCount ? `${t('filters.filters')}, ${activeFilterLabel}` : t('filters.filters')} aria-haspopup="dialog" aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen((current) => !current)}>
      <ListFilter size={16} aria-hidden="true" />
      <span>{t('filters.filters')}</span>
      {activeFilterCount > 0 && <span className="filter-count" aria-hidden="true">{activeFilterCount}</span>}
    </button>
    {open && <div className="event-filter-popover" id={popoverId} role="dialog" aria-label={t('filters.events')}>
      <div className="event-filter-popover-header">
        <div><strong>{t('filters.events')}</strong></div>
        <button className="event-filter-clear" type="button" onClick={onClear} disabled={!activeFilterCount}>{t('filters.clear')}</button>
      </div>
      <EventFilterControls timeFilter={timeFilter} modalityFilter={modalityFilter} locationFilter={locationFilter} communityFilter={communityFilter} communityOptions={communityOptions} onTimeChange={onTimeChange} onModalityChange={onModalityChange} onLocationChange={onLocationChange} onCommunityChange={onCommunityChange} showTimeFilter={showTimeFilter} showCommunityFilter={showCommunityFilter} />
    </div>}
  </div>
}
