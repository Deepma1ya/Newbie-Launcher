(() => {
  'use strict'
  document.documentElement.dataset.ready = '1'

  const $ = (selector, root = document) => root.querySelector(selector)
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const REPO = 'Deepma1ya/Newbie-Launcher'
  const FALLBACK_VERSION = '0.1.49'
  const GITHUB_RELEASES = `https://github.com/${REPO}/releases/latest`
  let downloadUrl = GITHUB_RELEASES

  /* ---------- Theme ---------- */
  const root = document.documentElement
  const themeToggle = $('#theme-toggle')
  const systemTheme = window.matchMedia('(prefers-color-scheme: light)')

  function updateThemeButton() {
    if (!themeToggle) return
    const light = root.dataset.theme === 'light'
    themeToggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme')
    themeToggle.setAttribute('aria-pressed', String(light))
    const meta = document.getElementById('theme-color')
    if (meta) meta.setAttribute('content', light ? '#f5f8f2' : '#070b08')
  }

  function setTheme(theme, persist = true) {
    root.dataset.theme = theme
    if (persist) {
      try {
        localStorage.setItem('newbie-theme', theme)
      } catch {}
    }
    updateThemeButton()
  }

  updateThemeButton()
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      setTheme(root.dataset.theme === 'light' ? 'dark' : 'light')
    })
  }
  systemTheme.addEventListener?.('change', (event) => {
    let saved = null
    try {
      saved = localStorage.getItem('newbie-theme')
    } catch {}
    if (!saved) setTheme(event.matches ? 'light' : 'dark', false)
  })

  /* ---------- Mobile navigation ---------- */
  const menuToggle = $('#menu-toggle')
  const mobileNav = $('#mobile-nav')

  function closeMenu() {
    if (!menuToggle || !mobileNav) return
    menuToggle.setAttribute('aria-expanded', 'false')
    menuToggle.setAttribute('aria-label', 'Open menu')
    mobileNav.hidden = true
  }

  function openMenu() {
    if (!menuToggle || !mobileNav) return
    menuToggle.setAttribute('aria-expanded', 'true')
    menuToggle.setAttribute('aria-label', 'Close menu')
    mobileNav.hidden = false
  }

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      if (mobileNav.hidden) openMenu()
      else closeMenu()
    })
    $$('a', mobileNav).forEach((link) => link.addEventListener('click', closeMenu))
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !mobileNav.hidden) {
        closeMenu()
        menuToggle.focus()
      }
    })
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900 && !mobileNav.hidden) closeMenu()
    })
  }

  /* ---------- Sticky header ---------- */
  const header = $('.site-header')
  function updateHeader() {
    if (!header) return
    header.classList.toggle('scrolled', window.scrollY > 12)
  }
  updateHeader()
  window.addEventListener('scroll', updateHeader, { passive: true })

  /* ---------- Scroll reveal + counters ---------- */
  const revealItems = $$('[data-reveal]')
  const counterItems = $$('[data-count]')

  function showAllReveals() {
    revealItems.forEach((item) => item.classList.add('is-visible'))
    counterItems.forEach((item) => {
      item.textContent = item.dataset.count ?? item.textContent
    })
  }

  function animateCounter(element) {
    const target = Number(element.dataset.count)
    if (!Number.isFinite(target) || reducedMotion.matches) {
      element.textContent = String(target)
      return
    }
    const duration = 900
    const started = performance.now()
    const from = 0
    function frame(now) {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      element.textContent = String(Math.round(from + (target - from) * eased))
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          revealObserver.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )
    revealItems.forEach((item) => revealObserver.observe(item))

    const counterObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          animateCounter(entry.target)
          counterObserver.unobserve(entry.target)
        }
      },
      { threshold: 0.6 }
    )
    counterItems.forEach((item) => counterObserver.observe(item))
  } else {
    showAllReveals()
  }

  /* ---------- Active nav ---------- */
  const navLinks = $$('.desktop-nav a')
  const sectionIds = navLinks
    .map((link) => link.getAttribute('href'))
    .filter((href) => href && href.startsWith('#') && href.length > 1)
    .map((href) => href.slice(1))

  if ('IntersectionObserver' in window && sectionIds.length) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`)
          })
        }
      },
      { rootMargin: '-38% 0px -54% 0px', threshold: 0 }
    )
    sectionIds.forEach((id) => {
      const section = document.getElementById(id)
      if (section) sectionObserver.observe(section)
    })
  }

  /* ---------- Parallax + spotlight ---------- */
  const heroVisual = $('[data-parallax]')
  if (heroVisual && finePointer.matches && !reducedMotion.matches) {
    let frame = 0
    let targetX = 0
    let targetY = 0
    heroVisual.addEventListener('pointermove', (event) => {
      const rect = heroVisual.getBoundingClientRect()
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        heroVisual.style.setProperty('--px', targetX.toFixed(3))
        heroVisual.style.setProperty('--py', targetY.toFixed(3))
      })
    })
    heroVisual.addEventListener('pointerleave', () => {
      heroVisual.style.setProperty('--px', '0')
      heroVisual.style.setProperty('--py', '0')
    })
  }

  if (finePointer.matches) {
    $$('.spotlight').forEach((card) => {
      let frame = 0
      card.addEventListener('pointermove', (event) => {
        if (frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          const rect = card.getBoundingClientRect()
          card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
          card.style.setProperty('--my', `${event.clientY - rect.top}px`)
        })
      })
    })
  }

  /* ---------- Tour tabs ---------- */
  $$('[data-tabs]').forEach((tour) => {
    const tabs = $$('[role="tab"]', tour)
    const panels = $$('[role="tabpanel"]', tour)

    function activate(tab, focus = false) {
      const name = tab.dataset.tab
      tabs.forEach((entry) => {
        const selected = entry === tab
        entry.classList.toggle('is-active', selected)
        entry.setAttribute('aria-selected', String(selected))
        entry.tabIndex = selected ? 0 : -1
      })
      panels.forEach((panel) => {
        const selected = panel.dataset.panel === name
        panel.hidden = !selected
        panel.classList.toggle('is-active', selected)
      })
      if (focus) tab.focus()
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab))
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') {
          return
        }
        event.preventDefault()
        let next = index
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
        if (event.key === 'Home') next = 0
        if (event.key === 'End') next = tabs.length - 1
        activate(tabs[next], true)
      })
    })
  })

  /* ---------- FAQ: one open at a time ---------- */
  const faqItems = $$('.faq-item')
  faqItems.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return
      faqItems.forEach((other) => {
        if (other !== item) other.open = false
      })
    })
  })

  /* ---------- Terminal demo ---------- */
  const terminalOutput = $('#terminal-output')
  const terminalCommand = $('#terminal-command')
  const terminalChips = $$('[data-command]')
  const commandResults = {
    tps: [
      ['info', 'TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.9'],
      ['ok', 'Overall: Mean tick time: 1.8 ms · 2 players online']
    ],
    list: [['ok', 'There are 2 of a max of 20 players online: Alex, Steve']],
    'time set day': [['ok', 'Set the time to 1000']],
    'weather clear': [['ok', 'Set the weather to clear']],
    'whitelist add Alex': [['ok', 'Added Alex to the whitelist']]
  }
  let terminalToken = 0
  let terminalBusy = false

  function timestamp() {
    const now = new Date()
    return `[${now.toTimeString().slice(0, 8)}]`
  }

  function appendTerminalLine(kind, text) {
    if (!terminalOutput) return
    const line = document.createElement('p')
    const time = document.createElement('span')
    time.className = 'log-time'
    time.textContent = timestamp()
    line.appendChild(time)
    line.appendChild(document.createTextNode(' '))
    const label = document.createElement('span')
    label.className = kind === 'ok' ? 'log-ok' : 'log-info'
    label.textContent = kind === 'ok' ? '[Newbie]' : '[Server thread/INFO]'
    line.appendChild(label)
    line.appendChild(document.createTextNode(` ${text}`))
    terminalOutput.appendChild(line)
    while (terminalOutput.children.length > 14) terminalOutput.firstElementChild?.remove()
    terminalOutput.scrollTop = terminalOutput.scrollHeight
  }

  function typeCommand(command, token) {
    return new Promise((resolve) => {
      if (!terminalCommand) return resolve()
      terminalCommand.textContent = ''
      if (reducedMotion.matches) {
        terminalCommand.textContent = command
        resolve()
        return
      }
      let index = 0
      const interval = window.setInterval(() => {
        if (token !== terminalToken) {
          window.clearInterval(interval)
          resolve()
          return
        }
        index += 1
        terminalCommand.textContent = command.slice(0, index)
        if (index >= command.length) {
          window.clearInterval(interval)
          resolve()
        }
      }, 34)
    })
  }

  async function runTerminalCommand(command) {
    if (!commandResults[command] || terminalBusy) return
    terminalBusy = true
    terminalToken += 1
    const token = terminalToken
    terminalChips.forEach((chip) => chip.classList.toggle('is-active', chip.dataset.command === command))
    await typeCommand(command, token)
    if (token !== terminalToken) {
      terminalBusy = false
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, reducedMotion.matches ? 0 : 180))
    if (token !== terminalToken) {
      terminalBusy = false
      return
    }
    for (const [kind, text] of commandResults[command]) {
      appendTerminalLine(kind, text)
    }
    terminalBusy = false
  }

  terminalChips.forEach((chip) => {
    chip.addEventListener('click', () => void runTerminalCommand(chip.dataset.command))
  })

  /* ---------- GitHub release ---------- */
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
    const value = bytes / 1024 ** index
    return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`
  }

  function setDownloadLinks(url) {
    downloadUrl = url || GITHUB_RELEASES
    $$('[data-download]').forEach((link) => {
      link.href = downloadUrl
    })
  }

  function setVersion(version) {
    const clean = String(version || FALLBACK_VERSION).replace(/^v/i, '')
    $$('[data-version]').forEach((node) => {
      node.textContent = clean
    })
  }

  async function loadLatestRelease() {
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
      const release = await response.json()
      const asset = Array.isArray(release.assets)
        ? release.assets.find((entry) => /setup\.exe$/i.test(entry.name) && !/blockmap$/i.test(entry.name))
        : undefined
      setVersion(release.tag_name || FALLBACK_VERSION)
      if (asset?.browser_download_url) {
        setDownloadLinks(asset.browser_download_url)
        const size = formatBytes(asset.size)
        $$('[data-download-meta]').forEach((node) => {
          node.textContent = size ? `Windows x64 · ${size}` : 'Windows x64 · .exe'
        })
      } else {
        setDownloadLinks(release.html_url || GITHUB_RELEASES)
      }
      const published = release.published_at ? new Date(release.published_at) : null
      if (published && !Number.isNaN(published.getTime())) {
        $$('[data-release-date]').forEach((node) => {
          node.textContent = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(published)
        })
      }
      if (release.html_url) {
        $$('[data-release-notes]').forEach((node) => {
          node.href = release.html_url
        })
      }
    } catch {
      // The static fallback links and version remain usable without the API.
      setVersion(FALLBACK_VERSION)
      setDownloadLinks(GITHUB_RELEASES)
    }
  }

  setVersion(FALLBACK_VERSION)
  setDownloadLinks(GITHUB_RELEASES)
  void loadLatestRelease()

  /* ---------- Copy download link ---------- */
  const toast = $('#toast')
  let toastTimer = 0
  function showToast(message) {
    if (!toast) return
    toast.textContent = message
    toast.classList.add('show')
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400)
  }

  $$('[data-copy-download]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(downloadUrl)
        showToast('Download link copied')
      } catch {
        showToast('Copy failed — open the releases page instead')
      }
    })
  })
})()
