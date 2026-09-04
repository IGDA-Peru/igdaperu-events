export type Role = 'reader' | 'community_editor' | 'community_admin' | 'platform_admin'
export type CommunityStatus = 'pending' | 'approved' | 'suspended'
export type EventStatus = 'draft' | 'published' | 'archived'
export type EventVisibility = 'public' | 'network'
export type LocationType = 'venue' | 'online' | 'hybrid'
export type MeetingProvider = 'zoom' | 'google_meet' | 'other'

export type Community = {
  id: string
  slug: string
  name: string
  description: string
  logoPath?: string | null
  websiteUrl?: string | null
  discordUrl?: string | null
  status: CommunityStatus
}

export type EventItem = {
  id: string
  slug: string
  communityId: string
  communityName: string
  communitySlug: string
  communityLogoPath?: string | null
  title: string
  description: string
  type: string
  startsAt: string | null
  endsAt: string | null
  timezone: string
  locationType: LocationType
  venueName?: string | null
  address?: string | null
  mapUrl?: string | null
  placeId?: string | null
  formattedAddress?: string | null
  latitude?: number | null
  longitude?: number | null
  meetingUrl?: string | null
  meetingProvider?: MeetingProvider | null
  coverPath?: string | null
  visibility: EventVisibility
  status: EventStatus
}

export type EventInput = {
  communityId: string
  title: string
  slug: string
  description: string
  type: string
  startsAt: string
  endsAt: string
  locationType: LocationType
  venueName: string
  address: string
  mapUrl: string
  placeId: string
  formattedAddress: string
  latitude: number | null
  longitude: number | null
  meetingUrl: string
  meetingProvider: MeetingProvider
  visibility: EventVisibility
  status: EventStatus
}

export type Membership = {
  communityId: string
  communityName: string
  communitySlug: string
  communityLogoPath?: string | null
  role: Role
  status: 'active' | 'invited' | 'revoked'
}

export type CommunityMemberEmail = {
  email: string
}

export type Profile = {
  id: string
  displayName: string
  avatarPath?: string | null
}

export type EventReport = {
  id: string
  eventId: string
  eventTitle: string
  eventSlug: string
  reason: string
  createdAt: string
  resolvedAt?: string | null
}

export type CommunitySyncSkippedRow = {
  row: number
  name?: string
  sourceId?: string
  reason: string
}

export type CommunitySyncResult = {
  runId: string
  sheetName: string
  fetchedRows: number
  eligibleRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  skippedRows: CommunitySyncSkippedRow[]
}

export type GoogleCalendarSyncResult = {
  calendarId: string
  sourceEvents: number
  created: number
  updated: number
  removed: number
  errors: number
  errorItems: Array<{ eventId?: string; message: string }>
}
