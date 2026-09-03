import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, json, options } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const DEFAULT_SHEET_NAME = 'TO NOTION'
const DEFAULT_SHEET_RANGE = 'A1:V1000'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

const HEADERS = {
  timestamp: 'Timestamp',
  community: 'Nombre de la comunidad',
  description: 'Breve descripcion de la comunidad',
  foundationDate: 'Fecha de Inicio de Actividades (O fundación)',
  categories: 'Tipo de comunidad\nIndica a que rubro pertenece tu comunidad',
  activities: '¿Qué actividades realizan?',
  headquarters: 'Sede Principal de la comunidad (Ciudad)',
  primaryRepresentative: 'Nombre del Primer Representante',
  secondaryRepresentative: 'Nombre del Segundo Representante',
  email: 'Correo electrónico de contacto',
  activeMembers: 'Miembros activos',
  nature: '¿Cuál es la naturaleza de su organización?',
  socialNetworks: '¿Con qué redes sociales cuentan?',
  linktree: 'Linktree de Comunidad',
  validation: 'VALIDACIÓN',
  sourceId: 'ID de sincronización',
} as const

type SheetValue = string | number | boolean | null
type SheetRow = SheetValue[]
type HeaderIndexes = Record<string, number | undefined>

type SyncRow = {
  source_id: string
  name: string
  slug: string
  description: string
  founded_on: string | null
  categories: string
  activities: string
  headquarters: string
  organization_nature: string
  social_networks: string
  website_url: string | null
  linktree_url: string | null
  source_validated: boolean
  source_updated_at: string | null
  last_synced_at: string
  primary_representative: string
  secondary_representative: string
  contact_email: string
  active_members: string
  additional_info: string
}

type SkippedRow = { row: number; name?: string; sourceId?: string; reason: string }

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getHeaderIndexes(headers: SheetRow): HeaderIndexes {
  const indexes: HeaderIndexes = {}
  headers.forEach((value, index) => {
    const key = normalizeHeader(value)
    if (key && !Object.values(indexes).includes(index)) indexes[key] = index
  })
  return indexes
}

function findHeader(indexes: HeaderIndexes, ...names: string[]) {
  for (const name of names) {
    const index = indexes[normalizeHeader(name)]
    if (index !== undefined) return index
  }
  return undefined
}

function findHeaderContaining(indexes: HeaderIndexes, fragment: string) {
  const normalizedFragment = normalizeHeader(fragment)
  const match = Object.entries(indexes).find(([header]) => header.includes(normalizedFragment))
  return match ? match[1] : undefined
}

function getCell(row: SheetRow, index: number | undefined) {
  return index === undefined ? '' : String(row[index] ?? '').trim()
}

function isValidated(value: string) {
  return ['true', '1', 'yes', 'si', 'sí', 'approved', 'aprobado', 'x'].includes(normalizeHeader(value))
}

function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max).trim() : value
}

function slugify(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return slug || 'comunidad'
}

function makeUniqueSlug(name: string, sourceId: string, usedSlugs: Set<string>) {
  const base = slugify(name)
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base)
    return base
  }

  const suffix = slugify(sourceId).slice(0, 12) || 'fuente'
  const candidate = `${base.slice(0, Math.max(1, 100 - suffix.length - 1))}-${suffix}`
  let unique = candidate
  let counter = 2
  while (usedSlugs.has(unique)) unique = `${candidate.slice(0, 100 - String(counter).length - 1)}-${counter++}`
  usedSlugs.add(unique)
  return unique
}

function parseDate(value: string) {
  if (!value) return null
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  // La hoja está en locale en_US: las fechas formateadas llegan como M/D/YYYY.
  const usDate = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (usDate) return `${usDate[3]}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}`

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function parseTimestamp(value: string) {
  if (!value) return null
  const usDateTime = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/) 
  if (usDateTime) {
    const [, month, day, year, hour = '00', minute = '00', second = '00'] = usDateTime
    const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}-05:00`)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeUrl(value: string) {
  return /^https?:\/\//i.test(value) ? truncate(value, 500) : null
}

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToBytes(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function getGoogleAccessToken(serviceAccount: { client_email?: string; private_key?: string }) {
  if (!serviceAccount.client_email || !serviceAccount.private_key) throw new Error('La credencial de Google no contiene client_email o private_key')
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(serviceAccount.private_key.replace(/\\n/g, '\n')), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`))
  const assertion = `${header}.${payload}.${base64Url(new Uint8Array(signature))}`
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.access_token) throw new Error(`Google no entregó un token de acceso (${response.status})`)
  return String(result.access_token)
}

async function readSheet(sheetId: string, sheetName: string, range: string, accessToken: string) {
  const sheetRange = `${sheetName}!${range}`
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(sheetRange)}?majorDimension=ROWS`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`No pudimos leer la hoja de Google (${response.status}): ${result.error?.message || 'respuesta no válida'}`)
  return Array.isArray(result.values) ? result.values as SheetRow[] : []
}

function mapRows(values: SheetRow[], existing: Array<{ id: string; slug: string; source_id: string | null; name: string }>, syncedAt: string) {
  if (!values.length) throw new Error('La hoja TO NOTION no contiene filas')
  const indexes = getHeaderIndexes(values[0])
  const requiredHeaders = [HEADERS.community, HEADERS.validation, HEADERS.sourceId]
  const missingHeaders = requiredHeaders.filter((header) => findHeader(indexes, header) === undefined)
  if (missingHeaders.length) throw new Error(`Faltan columnas requeridas en TO NOTION: ${missingHeaders.join(', ')}`)

  const index = {
    timestamp: findHeader(indexes, HEADERS.timestamp),
    community: findHeader(indexes, HEADERS.community),
    description: findHeader(indexes, HEADERS.description),
    foundationDate: findHeader(indexes, HEADERS.foundationDate),
    categories: findHeader(indexes, HEADERS.categories),
    activities: findHeader(indexes, HEADERS.activities),
    headquarters: findHeader(indexes, HEADERS.headquarters),
    primaryRepresentative: findHeader(indexes, HEADERS.primaryRepresentative),
    secondaryRepresentative: findHeader(indexes, HEADERS.secondaryRepresentative),
    email: findHeader(indexes, HEADERS.email),
    activeMembers: findHeader(indexes, HEADERS.activeMembers),
    nature: findHeader(indexes, HEADERS.nature),
    socialNetworks: findHeader(indexes, HEADERS.socialNetworks),
    linktree: findHeader(indexes, HEADERS.linktree),
    validation: findHeader(indexes, HEADERS.validation),
    sourceId: findHeader(indexes, HEADERS.sourceId),
    additionalInfo: findHeader(indexes, 'Mensaje adicional', 'Información adicional', 'Informacion adicional', 'Comentarios')
      ?? findHeaderContaining(indexes, 'información adicional')
      ?? findHeaderContaining(indexes, 'comentario')
      ?? findHeaderContaining(indexes, 'mensaje'),
  }
  const skippedRows: SkippedRow[] = []
  const syncRows: SyncRow[] = []
  const usedSourceIds = new Set<string>()
  const usedSlugs = new Set(existing.map((community) => community.slug))

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex]
    const name = truncate(getCell(row, index.community), 120)
    if (!name) continue
    const sourceId = truncate(getCell(row, index.sourceId), 160)
    if (!isValidated(getCell(row, index.validation))) {
      skippedRows.push({ row: rowIndex + 1, name, sourceId: sourceId || undefined, reason: 'VALIDACIÓN no está activa' })
      continue
    }
    if (!sourceId) {
      skippedRows.push({ row: rowIndex + 1, name, reason: 'Falta ID de sincronización' })
      continue
    }
    if (usedSourceIds.has(sourceId)) {
      skippedRows.push({ row: rowIndex + 1, name, sourceId, reason: 'ID de sincronización repetido' })
      continue
    }
    usedSourceIds.add(sourceId)

    const existingBySource = existing.find((community) => community.source_id === sourceId)
    const existingByName = existing.filter((community) => !community.source_id && community.name.trim().toLowerCase() === name.trim().toLowerCase())
    const matchingCommunity = existingBySource || (existingByName.length === 1 ? existingByName[0] : undefined)
    const slug = matchingCommunity?.slug || makeUniqueSlug(name, sourceId, usedSlugs)
    const description = truncate(getCell(row, index.description), 1000)
    const linktreeUrl = normalizeUrl(getCell(row, index.linktree))

    syncRows.push({
      source_id: sourceId,
      name,
      slug,
      description,
      founded_on: parseDate(getCell(row, index.foundationDate)),
      categories: truncate(getCell(row, index.categories), 2000),
      activities: truncate(getCell(row, index.activities), 5000),
      headquarters: truncate(getCell(row, index.headquarters), 300),
      organization_nature: truncate(getCell(row, index.nature), 500),
      social_networks: truncate(getCell(row, index.socialNetworks), 2000),
      website_url: linktreeUrl,
      linktree_url: linktreeUrl,
      source_validated: true,
      source_updated_at: parseTimestamp(getCell(row, index.timestamp)),
      last_synced_at: syncedAt,
      primary_representative: truncate(getCell(row, index.primaryRepresentative), 200),
      secondary_representative: truncate(getCell(row, index.secondaryRepresentative), 200),
      contact_email: truncate(getCell(row, index.email), 320),
      active_members: truncate(getCell(row, index.activeMembers), 100),
      additional_info: truncate(getCell(row, index.additionalInfo), 3000),
    })
  }

  return { syncRows, skippedRows }
}

async function getGoogleRows() {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  const sheetId = Deno.env.get('GOOGLE_SHEET_ID')
  const sheetName = Deno.env.get('GOOGLE_SHEET_NAME') || DEFAULT_SHEET_NAME
  const range = Deno.env.get('GOOGLE_SHEET_RANGE') || DEFAULT_SHEET_RANGE
  if (!serviceAccountJson || !sheetId) throw new Error('Faltan los secrets GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SHEET_ID')
  let serviceAccount: { client_email?: string; private_key?: string }
  try {
    serviceAccount = JSON.parse(serviceAccountJson)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON válido')
  }
  const accessToken = await getGoogleAccessToken(serviceAccount)
  return readSheet(sheetId, sheetName, range, accessToken)
}

async function updateRun(runId: string, values: Record<string, unknown>) {
  await admin.from('community_sync_runs').update(values).eq('id', runId)
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null) {
    const details = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    if (typeof details.message === 'string' && details.message) return details.message
    try {
      const serialized = JSON.stringify(error)
      if (serialized && serialized !== '{}') return serialized
    } catch {
      // Fall through to the generic string conversion below.
    }
  }
  return String(error || 'Unexpected error')
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let runId: string | null = null
  let stage = 'authentication'
  try {
    const accessToken = bearerToken(request)
    if (!accessToken) return json({ error: 'Authentication required' }, 401)
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)

    stage = 'validating-platform-admin'
    const { data: platformMembership, error: membershipError } = await admin
      .from('memberships')
      .select('role')
      .eq('user_id', authData.user.id)
      .is('community_id', null)
      .eq('role', 'platform_admin')
      .eq('status', 'active')
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!platformMembership) return json({ error: 'Solo un administrador de IGDA puede sincronizar comunidades' }, 403)

    stage = 'creating-sync-run'
    const { data: run, error: runError } = await admin
      .from('community_sync_runs')
      .insert({ requested_by: authData.user.id, status: 'running' })
      .select('id')
      .single()
    if (runError || !run) throw runError || new Error('No pudimos iniciar el registro de sincronización')
    runId = run.id

    stage = 'reading-google-sheet'
    const values = await getGoogleRows()
    stage = 'loading-existing-communities'
    const { data: existing, error: existingError } = await admin.from('communities').select('id,slug,source_id,name')
    if (existingError) throw existingError
    const syncedAt = new Date().toISOString()
    stage = 'mapping-sheet'
    const { syncRows, skippedRows } = mapRows(values, existing || [], syncedAt)
    if (!syncRows.length) throw new Error('No hay comunidades validadas para importar')

    stage = 'syncing-database'
    const { data: resultRows, error: syncError } = await admin.rpc('sync_community_rows', { p_rows: syncRows })
    if (syncError) throw syncError
    const rows = (resultRows || []) as Array<{ source_id: string; community_id: string | null; action: string; message: string | null }>
    const rpcSkipped = rows.filter((row) => row.action === 'skipped').map((row) => ({ row: 0, sourceId: row.source_id, reason: row.message || 'Fila omitida' }))
    const created = rows.filter((row) => row.action === 'created').length
    const updated = rows.filter((row) => row.action === 'updated').length
    const skipped = skippedRows.length + rpcSkipped.length
    const details = { skippedRows: [...skippedRows, ...rpcSkipped] }

    stage = 'finalizing-sync-run'
    await updateRun(runId, {
      finished_at: new Date().toISOString(),
      status: 'succeeded',
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      error_count: 0,
      details,
    })
    await admin.from('audit_log').insert({
      actor_id: authData.user.id,
      action: 'communities.sheet_sync',
      entity_type: 'community_sync_run',
      entity_id: runId,
      metadata: { created, updated, skipped, fetched_rows: Math.max(0, values.length - 1), eligible_rows: syncRows.length },
    })

    return json({
      runId,
      sheetName: Deno.env.get('GOOGLE_SHEET_NAME') || DEFAULT_SHEET_NAME,
      fetchedRows: Math.max(0, values.length - 1),
      eligibleRows: syncRows.length,
      created,
      updated,
      skipped,
      errors: 0,
      skippedRows: details.skippedRows,
    })
  } catch (error) {
    const message = errorMessage(error)
    console.error('sync-communities failed', { stage, message })
    if (runId) await updateRun(runId, { finished_at: new Date().toISOString(), status: 'failed', error_count: 1, details: { stage, error: message } })
    return json({ error: message, stage, runId }, 500)
  }
})
