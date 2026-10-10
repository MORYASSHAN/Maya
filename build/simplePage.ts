import type { Plugin } from 'vite'
import {
  LINKS,
  ORBIT,
  PHASES,
  SITE,
  SOCIALS,
  TRACTION,
  type DetailBlock,
} from '../src/content/phases.ts'

/**
 * Renders /simple at build time from src/content/phases.ts — plain semantic HTML,
 * no JavaScript, no WebGL. Also fills the meta placeholders in both HTML entries.
 */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (s: string) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

const pad = (n: number) => String(n).padStart(2, '0')

function block(b: DetailBlock): string {
  switch (b.type) {
    case 'h':
      return `<h4>${esc(b.text)}</h4>`
    case 'p':
      return `<p>${inline(b.text)}</p>`
    case 'quote':
      return `<blockquote>${inline(b.text)}${b.cite ? `<footer>— ${esc(b.cite)}</footer>` : ''}</blockquote>`
    case 'list':
      return `<ul>${b.items
        .map((it) =>
          typeof it === 'string'
            ? `<li>${inline(it)}</li>`
            : `<li>${inline(it.text)}<ul>${it.items.map((s) => `<li>${inline(s)}</li>`).join('')}</ul></li>`,
        )
        .join('')}</ul>`
  }
}

const status = (st?: 'live' | 'dev') =>
  st ? `<span class="status status--${st}">${st === 'live' ? 'Live' : 'In development'}</span>` : ''

const arrow = (dir = 0) =>
  `<svg class="icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="transform:rotate(${dir}deg)"><path d="M1 7h11M8 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

/** One line per sentence, no full stops (matches the immersive site). */
const headline = (title: string) =>
  title
    .split(/(?<=\.)\s+/)
    .map((l) => l.replace(/\.$/, '').trim())
    .filter(Boolean)
    .map((l) => `<span class="line">${esc(l)}</span>`)
    .join('')

const numbers = (list: { value: string; label: string }[]) =>
  `<ul class="numbers">${list.map((s) => `<li><span class="numbers__v">${esc(s.value)}</span><span class="numbers__l">${esc(s.label)}</span></li>`).join('')}</ul>`

export function renderSimple() {
  const sections = PHASES.map((p, i) => {
    const H = i === 0 ? 'h1' : 'h2'
    const meta =
      i === 0
        ? ''
        : `<p class="meta"><span class="meta__num">${pad(i + 1)}</span><span class="meta__name">${esc(p.name)}</span>${status(p.status)}</p>`
    const col = (key: 'live' | 'dev', label: string, items: { name: string; id: string }[]) =>
      `<div class="ledger__col ledger__col--${key}"><p class="ledger__head"><span>${label}</span><span class="ledger__count">${pad(items.length)}</span></p><ul>${items
        .map((n) => `<li><a href="#${n.id}"><span>${esc(n.name)}</span>${arrow()}</a></li>`)
        .join('')}</ul></div>`
    const ledger =
      p.id === 'status'
        ? `<div class="ledger">${col('live', 'Live', ORBIT.live)}${col('dev', 'Building', ORBIT.building)}</div>` +
          (TRACTION.length ? numbers(TRACTION) : '')
        : ''
    const ctas = p.ctas
      ? `<div class="actions">${p.ctas
          .map((c) => `<a class="${c.kind === 'primary' ? 'btn' : 'link'}" href="${esc(c.href)}"><span>${esc(c.label)}</span>${arrow()}</a>`)
          .join('')}</div>`
      : ''
    const socials =
      p.id === 'contact'
        ? `<ul class="socials">${SOCIALS.map((s) => `<li><a class="link" href="${esc(s.href)}" rel="noopener noreferrer"><span>${esc(s.label)}</span>${arrow(-45)}</a></li>`).join('')}</ul>`
        : ''
    const detail = p.detail
      ? `<details class="detail"><summary><span>${esc(SITE.hud.readMore)}</span><span class="detail__plus" aria-hidden="true"></span></summary><div class="prose"><h3 class="prose__title">${esc(p.detail.title)}</h3>${p.detail.blocks.map(block).join('')}</div></details>`
      : ''
    return `<section id="${p.id}" class="s-phase" aria-labelledby="h-${p.id}">
  ${meta}
  <${H} id="h-${p.id}" class="${i === 0 ? 'h-hero' : 'h-phase'}">${headline(p.title)}</${H}>
  ${p.subtitle ? `<p class="meta meta--sub">${esc(p.subtitle)}</p>` : ''}
  ${p.body.map((b) => `<p class="body">${esc(b)}</p>`).join('')}
  ${p.tags ? `<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  ${p.stats ? numbers(p.stats) : ''}${ledger}${ctas}${socials}${detail}
</section>`
  }).join('\n')

  return `<header class="s-top">
  <a class="wordmark" href="/simple">${esc(SITE.wordmark)}</a>
  <nav aria-label="Site"><a class="navlink" href="/">Immersive view</a><a class="navlink" href="${esc(LINKS.deck)}">${esc(SITE.hud.deck)}</a></nav>
</header>
<main id="content" class="s-main">
${sections}
</main>
<footer class="s-foot">${esc(SITE.footer)}</footer>`
}

// Mirror Vercel's cleanUrls locally: /simple → /simple/index.html
const rewriteSimple = (req: { url?: string }, _res: unknown, next: () => void) => {
  if (req.url === '/simple' || req.url?.startsWith('/simple?')) req.url = '/simple/index.html' + req.url.slice(7)
  next()
}

export function sitePlugin(siteUrl: string): Plugin {
  return {
    name: 'dforr-site-html',
    configureServer(server) {
      server.middlewares.use(rewriteSimple)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteSimple)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
` })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc></url>
  <url><loc>${siteUrl}/simple</loc></url>
</urlset>
`,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replaceAll('%SITE_TITLE%', esc(SITE.title))
          .replaceAll('%SITE_DESCRIPTION%', esc(SITE.description))
          .replaceAll('%SITE_URL%', siteUrl)
          .replace('<!--SIMPLE_BODY-->', renderSimple())
      },
    },
  }
}
