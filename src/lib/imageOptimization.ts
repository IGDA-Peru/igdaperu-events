export type ImageOptimizationOptions = {
  maxWidth: number
  maxHeight: number
  maxBytes: number
  quality: number
}

export const communityLogoOptimization: ImageOptimizationOptions = {
  maxWidth: 1024,
  maxHeight: 1024,
  maxBytes: 900 * 1024,
  quality: 0.84,
}

export const eventBannerOptimization: ImageOptimizationOptions = {
  maxWidth: 1600,
  maxHeight: 900,
  maxBytes: 1_800 * 1024,
  quality: 0.82,
}

export function getConstrainedDimensions(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (width <= 0 || height <= 0) throw new Error('Las dimensiones de la imagen no son válidas.')
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No pudimos leer la imagen.'))
    }
    image.src = url
  })
}

function renderWebp(image: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Este navegador no permite optimizar la imagen.'))
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No pudimos generar la versión optimizada de la imagen.'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

export async function optimizeImageForUpload(file: File, options: ImageOptimizationOptions): Promise<File> {
  const image = await loadImage(file)
  const dimensions = getConstrainedDimensions(image.naturalWidth, image.naturalHeight, options.maxWidth, options.maxHeight)
  let quality = options.quality
  let blob = await renderWebp(image, dimensions.width, dimensions.height, quality)

  for (let attempt = 0; blob.size > options.maxBytes && attempt < 4; attempt += 1) {
    quality = Math.max(0.55, quality - 0.07)
    blob = await renderWebp(image, dimensions.width, dimensions.height, quality)
  }

  if (blob.size > options.maxBytes) throw new Error('La imagen sigue siendo demasiado pesada después de optimizarla.')
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagen'
  return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() })
}
