import { useEffect, useRef } from 'react'
import { attachPageIndexContrast } from '../lib/page-index-contrast'

type PageIndexLink = {
  label: string
  href: string
}

type PageIndexProps = {
  label: string
  links: PageIndexLink[]
}

export function PageIndex({ label, links }: PageIndexProps) {
  const floatingIndexRef = useRef<HTMLDetailsElement>(null)
  const desktopIndexRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const index = desktopIndexRef.current
    return index ? attachPageIndexContrast(index) : undefined
  }, [])

  const closeFloatingIndex = () => floatingIndexRef.current?.removeAttribute('open')

  if (!links.length) return null

  return <>
    <details ref={floatingIndexRef} className="page-index page-index--floating page-index--floating-above-assistant" data-page-index>
      <summary className="page-index__toggle" aria-label={label} title={label}>
        <span className="page-index__icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" focusable="false"><path d="M4 5.5h12M4 10h12M4 14.5h12" /></svg>
        </span>
        <span className="page-index__close-icon" aria-hidden="true">×</span>
      </summary>
      <nav className="page-index__panel" aria-label={label}>
        <p className="page-index__panel-title">{label}</p>
        <ul>{links.map((link) => <li key={link.href}><a href={link.href} onClick={closeFloatingIndex}>{link.label}</a></li>)}</ul>
      </nav>
    </details>
    <nav ref={desktopIndexRef} className="page-index page-index--desktop" data-page-index-desktop aria-label={label}>
      {links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
    </nav>
  </>
}
