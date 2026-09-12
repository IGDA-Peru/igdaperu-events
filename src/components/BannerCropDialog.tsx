import { Check, Crop, Move, X, ZoomIn } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

type BannerCropDialogProps = {
  sourceUrl: string
  fileName: string
  processing?: boolean
  error?: string
  onCancel: () => void
  onConfirm: (file: File) => void | Promise<void>
}

type Point = { x: number; y: number }
type FrameSize = { width: number; height: number }

const OUTPUT_WIDTH = 1600
const OUTPUT_HEIGHT = 900

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function cropLayout(image: HTMLImageElement, frame: FrameSize, zoom: number) {
  const baseScale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
  const scale = baseScale * zoom
  const scaledWidth = image.naturalWidth * scale
  const scaledHeight = image.naturalHeight * scale
  return {
    scale,
    scaledWidth,
    scaledHeight,
    maxOffsetX: Math.max((scaledWidth - frame.width) / 2, 0),
    maxOffsetY: Math.max((scaledHeight - frame.height) / 2, 0),
  }
}

function clampPoint(point: Point, layout: ReturnType<typeof cropLayout>) {
  return {
    x: clamp(point.x, -layout.maxOffsetX, layout.maxOffsetX),
    y: clamp(point.y, -layout.maxOffsetY, layout.maxOffsetY),
  }
}

function cropImage(image: HTMLImageElement, frame: FrameSize, zoom: number, offset: Point, fileName: string): Promise<File> {
  const layout = cropLayout(image, frame, zoom)
  const sourceWidth = frame.width / layout.scale
  const sourceHeight = frame.height / layout.scale
  const sourceCenterX = image.naturalWidth / 2 - offset.x / layout.scale
  const sourceCenterY = image.naturalHeight / 2 - offset.y / layout.scale
  const sourceX = clamp(sourceCenterX - sourceWidth / 2, 0, image.naturalWidth - sourceWidth)
  const sourceY = clamp(sourceCenterY - sourceHeight / 2, 0, image.naturalHeight - sourceHeight)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_WIDTH
  canvas.height = OUTPUT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Este navegador no permite recortar la imagen.'))
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No pudimos generar el recorte del banner.'))
        return
      }
      const baseName = fileName.replace(/\.[^.]+$/, '') || 'banner'
      resolve(new File([blob], `${baseName}-recortado.webp`, { type: 'image/webp', lastModified: Date.now() }))
    }, 'image/webp', 0.94)
  })
}

export function BannerCropDialog({ sourceUrl, fileName, processing = false, error, onCancel, onConfirm }: BannerCropDialogProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [frame, setFrame] = useState<FrameSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [cropError, setCropError] = useState('')

  useEffect(() => {
    let active = true
    const nextImage = new Image()
    nextImage.onload = () => { if (active) setImage(nextImage) }
    nextImage.onerror = () => { if (active) { setImage(null); setCropError('No pudimos leer la imagen seleccionada.') } }
    nextImage.src = sourceUrl
    return () => { active = false; nextImage.onload = null; nextImage.onerror = null }
  }, [sourceUrl])

  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    const updateFrame = () => setFrame({ width: element.clientWidth, height: element.clientHeight })
    updateFrame()
    const observer = new ResizeObserver(updateFrame)
    observer.observe(element)
    return () => observer.disconnect()
  }, [image])

  const layout = useMemo(() => image && frame.width > 0 ? cropLayout(image, frame, zoom) : null, [frame, image, zoom])
  const safeOffset = layout ? clampPoint(offset, layout) : offset

  const imageStyle = layout ? {
    width: `${layout.scaledWidth}px`,
    height: `${layout.scaledHeight}px`,
    transform: `translate(calc(-50% + ${safeOffset.x}px), calc(-50% + ${safeOffset.y}px))`,
  } : undefined

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (processing || !layout) return
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: safeOffset }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragging = draggingRef.current
    if (!dragging || dragging.pointerId !== event.pointerId || !layout) return
    setOffset(clampPoint({ x: dragging.origin.x + event.clientX - dragging.start.x, y: dragging.origin.y + event.clientY - dragging.start.y }, layout))
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current?.pointerId === event.pointerId) draggingRef.current = null
  }

  const handleZoomChange = (value: number) => {
    setZoom(value)
    if (image && frame.width > 0) setOffset((current) => clampPoint(current, cropLayout(image, frame, value)))
  }

  const handleConfirm = async () => {
    if (!image || !layout || processing) return
    setCropError('')
    try {
      await onConfirm(await cropImage(image, frame, zoom, safeOffset, fileName))
    } catch (reason: unknown) {
      setCropError(reason instanceof Error ? reason.message : 'No pudimos generar el recorte del banner.')
    }
  }

  return <div className="modal-layer banner-crop-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !processing) onCancel() }}>
    <section className="banner-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="banner-crop-title" aria-describedby="banner-crop-description" onMouseDown={(event) => event.stopPropagation()}>
      <div className="banner-crop-heading">
        <div><span className="dashboard-kicker"><Crop size={14} aria-hidden="true" /> Ajustar banner</span><h2 id="banner-crop-title">Confirma el recorte</h2></div>
        <button className="icon-button" type="button" onClick={onCancel} disabled={processing} aria-label="Cancelar recorte"><X size={18} /></button>
      </div>
      <p className="banner-crop-description" id="banner-crop-description">El banner se guardará en formato horizontal 16:9. Arrastra la imagen para ajustar el encuadre.</p>
      <div ref={frameRef} className={`banner-crop-frame ${layout ? 'is-ready' : ''}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} role="img" aria-label="Vista previa del recorte del banner">
        {image && layout ? <img className="banner-crop-image" src={sourceUrl} alt="" draggable={false} style={imageStyle} /> : <span className="banner-crop-loading">Cargando vista previa…</span>}
      </div>
      <div className="banner-crop-controls">
        <label htmlFor="banner-crop-zoom"><span><ZoomIn size={16} aria-hidden="true" /> Zoom</span><input id="banner-crop-zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => handleZoomChange(Number(event.target.value))} disabled={!layout || processing} /></label>
        <small><Move size={14} aria-hidden="true" /> Arrastra para mover la imagen</small>
      </div>
      {(error || cropError) && <p className="form-message error" role="alert">{error || cropError}</p>}
      <div className="banner-crop-actions"><button className="secondary-button" type="button" onClick={onCancel} disabled={processing}>Cancelar</button><button className="primary-button" type="button" onClick={() => void handleConfirm()} disabled={!layout || processing}><Check size={16} aria-hidden="true" /> {processing ? 'Optimizando…' : 'Confirmar y optimizar'}</button></div>
    </section>
  </div>
}
