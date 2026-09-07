import { describe, expect, it } from 'vitest'
import { getConstrainedDimensions } from './imageOptimization'

describe('getConstrainedDimensions', () => {
  it('mantiene imágenes que ya caben en el límite', () => {
    expect(getConstrainedDimensions(800, 450, 1600, 900)).toEqual({ width: 800, height: 450 })
  })

  it('reduce imágenes grandes sin deformarlas', () => {
    expect(getConstrainedDimensions(4000, 2000, 1600, 900)).toEqual({ width: 1600, height: 800 })
  })

  it('limita por la altura cuando corresponde', () => {
    expect(getConstrainedDimensions(1200, 2400, 1024, 1024)).toEqual({ width: 512, height: 1024 })
  })
})
