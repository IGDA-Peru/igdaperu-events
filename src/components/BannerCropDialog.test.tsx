import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BannerCropDialog } from './BannerCropDialog'

const mockImages: MockImage[] = []

class MockImage {
  naturalWidth = 3200
  naturalHeight = 1200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''

  constructor() {
    mockImages.push(this)
  }
}

describe('BannerCropDialog', () => {
  beforeEach(() => {
    mockImages.length = 0
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(338)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['cropped'], { type: 'image/webp' })))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('confirms a centered 16:9 crop as an optimized WebP file', async () => {
    const onConfirm = vi.fn()

    render(<BannerCropDialog sourceUrl="blob:banner" fileName="hero.jpg" onCancel={vi.fn()} onConfirm={onConfirm} />)

    await act(async () => { mockImages[0].onload?.() })
    const confirmButton = await screen.findByRole('button', { name: 'Confirmar y optimizar' })
    await waitFor(() => expect(confirmButton).toBeEnabled())

    await act(async () => { confirmButton.click() })
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())

    const croppedFile = onConfirm.mock.calls[0][0] as File
    expect(croppedFile).toBeInstanceOf(File)
    expect(croppedFile.name).toBe('hero-recortado.webp')
    expect(croppedFile.type).toBe('image/webp')
  })
})
