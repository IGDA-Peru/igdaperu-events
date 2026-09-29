(() => {
  const igdaSites = new Map([
    ['igda.pe', 'main'],
    ['www.igda.pe', 'main'],
    ['eventos.igda.pe', 'events'],
    ['events.igda.pe', 'events'],
    ['calendar.igda.pe', 'events'],
    ['calendario.igda.pe', 'events'],
    ['games.igda.pe', 'games'],
    ['juegos.igda.pe', 'games'],
  ])
  const isIgdaUrl = (url) => ['http:', 'https:'].includes(url.protocol) && igdaSites.has(url.hostname)
  const siteForHost = (hostname) => igdaSites.get(hostname) || null
  const params = new URLSearchParams(window.location.search)
  const sourceHref = params.get('igda_from')
  const sourceTitle = params.get('igda_from_title')
  let returnTarget = null

  if (sourceHref && sourceTitle) {
    try {
      const sourceUrl = new URL(sourceHref)
      if (isIgdaUrl(sourceUrl) && siteForHost(sourceUrl.hostname) !== siteForHost(window.location.hostname)) {
        returnTarget = {
          href: sourceUrl.origin + sourceUrl.pathname + sourceUrl.hash,
          title: sourceTitle.trim().slice(0, 180) || sourceUrl.hostname,
        }
      }
    } catch {
      // Ignore malformed navigation context.
    }

    params.delete('igda_from')
    params.delete('igda_from_title')
    const query = params.toString()
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + (query ? '?' + query : '') + window.location.hash,
    )
  }

  const pageTitle = () => {
    if (siteForHost(window.location.hostname) === 'main' && /^\/(?:es|en|qu)?\/?$/.test(window.location.pathname)) {
      return 'igda.pe'
    }
    const heading = document.querySelector('main h1, #root h1')
    return heading?.textContent?.trim().replace(/\s+/g, ' ')
      || document.title.split(/\s*[|–—]\s*/)[0].trim()
      || window.location.hostname
  }

  const addReturnLink = () => {
    if (!returnTarget || document.querySelector('.cross-site-return')) return Boolean(returnTarget)
    const header = document.querySelector('.site-header-inner, .header-inner, .container.nav')
    const brand = header?.querySelector('.site-switcher, .brand-switcher')
      || header?.querySelector('.brand')
    if (!header || !brand) return false

    const link = document.createElement('a')
    link.className = 'cross-site-return'
    link.href = returnTarget.href
    link.rel = 'prev'
    const language = document.documentElement.lang.split('-')[0]
    const prefix = language === 'en' ? 'Back to ' : language === 'qu' ? 'Kutipay: ' : 'Volver a '
    link.setAttribute('aria-label', prefix + returnTarget.title)
    link.title = prefix + returnTarget.title

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('width', '18')
    icon.setAttribute('height', '18')
    icon.setAttribute('fill', 'none')
    icon.setAttribute('stroke', 'currentColor')
    icon.setAttribute('stroke-width', '2')
    icon.setAttribute('stroke-linecap', 'round')
    icon.setAttribute('stroke-linejoin', 'round')
    icon.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'm15 18-6-6 6-6')
    icon.append(path)

    const label = document.createElement('span')
    label.className = 'cross-site-return__label'
    label.textContent = returnTarget.title
    link.append(icon, label)
    brand.insertAdjacentElement('afterend', link)
    return true
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const link = event.target.closest('a[href]')
    if (!link) return
    if (link.matches('.brand-switcher-menu a, .site-switcher-menu a, .cross-site-return')) return

    try {
      const targetUrl = new URL(link.href, window.location.href)
      if (!isIgdaUrl(targetUrl) || siteForHost(targetUrl.hostname) === siteForHost(window.location.hostname)) return
      const sourceUrl = new URL(window.location.href)
      const sensitiveParameter = /(access_token|refresh_token|id_token|token|code|secret|password|email|auth|session|credential|redirect|next)/i
      Array.from(sourceUrl.searchParams.keys())
        .filter((key) => sensitiveParameter.test(key))
        .forEach((key) => sourceUrl.searchParams.delete(key))
      if (sourceUrl.hash.includes('=') && sensitiveParameter.test(sourceUrl.hash)) {
        sourceUrl.hash = ''
      }
      targetUrl.searchParams.set(
        'igda_from',
        sourceUrl.origin + sourceUrl.pathname + sourceUrl.search + sourceUrl.hash,
      )
      targetUrl.searchParams.set('igda_from_title', pageTitle())
      link.href = targetUrl.toString()
    } catch {
      // Ignore links that cannot be parsed as URLs.
    }
  }, true)

  if (returnTarget) {
    if (!addReturnLink()) {
      const observer = new MutationObserver(() => {
        if (addReturnLink()) observer.disconnect()
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
      window.setTimeout(() => observer.disconnect(), 10000)
    }
  }
})()
