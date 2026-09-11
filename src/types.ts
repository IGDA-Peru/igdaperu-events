export type Role = 'reader' | 'community_editor' | 'community_admin' | 'platform_admin'
export type CommunityStatus = 'pending' | 'approved' | 'suspended'
export type EventStatus = 'draft' | 'published' | 'archived'
export type EventProposalStatus = 'pending' | 'approved' | 'rejected'
export type EventVisibility = 'public' | 'network'
export type LocationType = 'venue' | 'online' | 'hybrid'
export type LocationPrecision = 'none' | 'department' | 'province' | 'exact'
export type EventAccessMode = 'registration_only' | 'location_access'
export type MeetingProvider = 'google_meet' | 'zoom' | 'discord' | 'other'
export type MeetingLinkVisibility = 'shared' | 'none'
export type ConversationStatus = 'pending' | 'active' | 'rejected'

export type Community = {
  id: string
  slug: string
  name: string
  description: string
  logoPath?: string | null
  brandColor?: string | null
  websiteUrl?: string | null
  discordUrl?: string | null
  status: CommunityStatus
}

export type EventItem = {
  id: string
  slug: string
  communityId: string | null
  communityName: string
  communitySlug: string
  communityLogoPath?: string | null
  communityColor?: string | null
  organizerName?: string | null
  creatorEmail?: string | null
  title: string
  description: string
  type: string
  startsAt: string | null
  endsAt: string | null
  isAllDay: boolean
  timezone: string
  locationType: LocationType
  accessMode?: EventAccessMode
  locationPrecision?: LocationPrecision
  locationDepartment?: string | null
  locationProvince?: string | null
  venueName?: string | null
  address?: string | null
  mapUrl?: string | null
  placeId?: string | null
  formattedAddress?: string | null
  latitude?: number | null
  longitude?: number | null
  meetingUrl?: string | null
  meetingProvider?: MeetingProvider | null
  meetingLinkVisibility?: MeetingLinkVisibility | null
  registrationUrl?: string | null
  coverPath?: string | null
  visibility: EventVisibility
  status: EventStatus
}

export type EventInput = {
  communityId: string | null
  organizerName?: string
  title: string
  slug: string
  description: string
  type: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  locationType: LocationType
  accessMode: EventAccessMode
  locationPrecision: LocationPrecision
  locationDepartment: string
  locationProvince: string
  venueName: string
  address: string
  mapUrl: string
  placeId: string
  formattedAddress: string
  latitude: number | null
  longitude: number | null
  meetingUrl: string
  registrationUrl: string
  meetingProvider: MeetingProvider
  meetingLinkVisibility: MeetingLinkVisibility
  coverPath?: string | null
  visibility: EventVisibility
  status: EventStatus
}

export type EventConflict = {
  id: string
  title: string
  communityName: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
}

export type Membership = {
  communityId: string
  communityName: string
  communitySlug: string
  communityLogoPath?: string | null
  communityColor?: string | null
  role: Role
  status: 'active' | 'invited' | 'revoked'
}

export type CommunityMemberEmail = {
  email: string
}

export type CommunityMember = {
  membershipId: string | null
  invitationId: string | null
  email: string
  role: Role
  status: 'active' | 'invited'
}

export type Profile = {
  id: string
  displayName: string
  firstName?: string
  lastName?: string
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

export type EventProposal = {
  id: string
  organizerName: string
  contactEmail: string
  title: string
  description: string
  type: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  timezone: string
  locationType: LocationType
  accessMode: EventAccessMode
  locationPrecision: LocationPrecision
  locationDepartment?: string | null
  locationProvince?: string | null
  venueName?: string | null
  address?: string | null
  mapUrl?: string | null
  placeId?: string | null
  formattedAddress?: string | null
  latitude?: number | null
  longitude?: number | null
  meetingUrl?: string | null
  meetingProvider?: MeetingProvider | null
  registrationUrl?: string | null
  communityId: string | null
  communityName?: string | null
  status: EventProposalStatus
  reviewNotes: string
  rejectionReason?: string | null
  reviewedAt?: string | null
  approvedEventId?: string | null
  createdAt: string
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

export type ChatIdentity = {
  communityId: string
  communityName: string
  communitySlug: string
  communityLogoPath?: string | null
}

export type ConversationParticipant = {
  conversationId: string
  communityId: string
  status: ConversationStatus
  lastReadAt?: string | null
  archivedAt?: string | null
}

export type CommunityConversation = {
  id: string
  status: ConversationStatus
  myCommunity: ChatIdentity
  otherCommunity: ChatIdentity
  requestedByCommunityId: string
  lastMessageAt?: string | null
  lastMessageBody?: string | null
  lastMessageAuthorDisplayName?: string | null
  unreadCount: number
  archivedAt?: string | null
  createdAt: string
}

export type ChatMessage = {
  id: string
  conversationId: string
  authorUserId: string
  authorCommunity: ChatIdentity
  authorDisplayName: string
  body: string
  createdAt: string
}
