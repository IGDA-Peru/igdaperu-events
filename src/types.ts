export type Role = 'reader' | 'community_editor' | 'community_admin' | 'platform_admin'
export type CommunityStatus = 'pending' | 'approved' | 'suspended'
export type EventStatus = 'draft' | 'published' | 'archived'
export type EventVisibility = 'public' | 'network'
export type LocationType = 'venue' | 'online' | 'hybrid'

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
  title: string
  description: string
  type: string
  startsAt: string
  endsAt: string
  timezone: string
  locationType: LocationType
  venueName?: string | null
  address?: string | null
  meetingUrl?: string | null
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
  meetingUrl: string
  visibility: EventVisibility
  status: EventStatus
}

export type Membership = {
  communityId: string
  communityName: string
  communitySlug: string
  role: Role
  status: 'active' | 'invited' | 'revoked'
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
