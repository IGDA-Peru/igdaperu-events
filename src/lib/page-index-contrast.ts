export function attachPageIndexContrast(index: HTMLElement): () => void {
  let frameId = 0

  const hasDarkSurface = (element: Element) => {
    const tagName = element.tagName.toLowerCase()
    if (['img', 'picture', 'video', 'canvas'].includes(tagName)) return true
    if (tagName === 'body' || tagName === 'html') return false

    const styles = getComputedStyle(element)
    if (styles.backgroundImage !== 'none') return true

    const colorValues = styles.backgroundColor.match(/rgba?\(([^)]+)\)/)?.[1]
      ?.split(/[\s,\/]+/)
      .map(Number)

    if (!colorValues || colorValues.length < 3 || (colorValues[3] ?? 1) < 0.15) return false

    const luminance = (colorValues[0] * 299 + colorValues[1] * 587 + colorValues[2] * 114) / 1000
    return luminance < 150
  }

  const updateIndexState = () => {
    frameId = 0
    if (getComputedStyle(index).display === 'none') return

    const rect = index.getBoundingClientRect()
    const sampleX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2))
    const sampleYs = [rect.top + rect.height * 0.25, rect.top + rect.height * 0.5, rect.top + rect.height * 0.75]
    const isOverDark = sampleYs.some((sampleY) =>
      document
        .elementsFromPoint(sampleX, sampleY)
        .filter((element) => !index.contains(element))
        .some((element) => {
          let current: Element | null = element

          while (current && current !== document.body) {
            if (hasDarkSurface(current)) return true
            current = current.parentElement
          }

          return false
        }),
    )

    index.classList.toggle('is-over-dark', isOverDark)
  }

  const requestIndexUpdate = () => {
    if (frameId) return
    frameId = window.requestAnimationFrame(updateIndexState)
  }

  window.addEventListener('scroll', requestIndexUpdate, { passive: true })
  window.addEventListener('resize', requestIndexUpdate)
  updateIndexState()

  return () => {
    window.removeEventListener('scroll', requestIndexUpdate)
    window.removeEventListener('resize', requestIndexUpdate)
    if (frameId) window.cancelAnimationFrame(frameId)
  }
}
