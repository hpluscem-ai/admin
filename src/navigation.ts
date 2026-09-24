export function navigate(path: string) {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (currentPath === path) return

  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function installInternalLinkNavigation() {
  if (window.location.pathname === '/' && window.location.hash.startsWith('#/')) {
    window.history.replaceState(null, '', window.location.hash.slice(1))
  }

  function handleInternalLink(event: MouseEvent) {
    const target = event.target
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(target instanceof Element)
    ) return

    const link = target.closest<HTMLAnchorElement>('a[href]')
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return

    const url = new URL(link.href, window.location.href)
    if (url.origin !== window.location.origin) return

    event.preventDefault()
    navigate(`${url.pathname}${url.search}${url.hash}`)
  }

  document.addEventListener('click', handleInternalLink)
  return () => document.removeEventListener('click', handleInternalLink)
}
