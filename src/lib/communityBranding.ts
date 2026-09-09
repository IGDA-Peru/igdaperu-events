export const DEFAULT_COMMUNITY_COLOR = '#d82028'

export const COMMUNITY_COLOR_PRESETS = [
  '#d82028',
  '#2c73b7',
  '#8250ad',
  '#659b3c',
  '#e26d1b',
  '#b88313',
] as const

export function normalizeCommunityColor(value?: string | null) {
  const color = value?.trim() || ''
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : DEFAULT_COMMUNITY_COLOR
}

export function communityTint(value?: string | null, opacity = 0.14) {
  const color = normalizeCommunityColor(value)
  const red = Number.parseInt(color.slice(1, 3), 16)
  const green = Number.parseInt(color.slice(3, 5), 16)
  const blue = Number.parseInt(color.slice(5, 7), 16)
  return `rgb(${red} ${green} ${blue} / ${opacity})`
}
