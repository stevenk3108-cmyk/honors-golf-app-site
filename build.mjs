// Builds blog.html, blog/<slug>.html and sitemap.xml from posts/*.txt
// Usage: node build.mjs      (see blog-howto.txt)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Your live domain, no trailing slash (e.g. 'https://honors.golf'). Leave empty until known:
// canonical links, social-share tags and the sitemap are only written when this is set.
const SITE_URL = '';
const SITE_NAME = 'Honors';

const root = path.dirname(fileURLToPath(import.meta.url));
const template = fs.readFileSync(path.join(root, '_template.html'), 'utf8');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const i = raw.indexOf('\n---');
  if (i < 0) throw new Error(`${file}: missing "---" line between the details and the body`);
  const meta = {};
  raw.slice(0, i).split('\n').forEach(line => {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  });
  for (const k of ['slug', 'title', 'seo-title', 'description', 'tag', 'date', 'read', 'image', 'image-size', 'image-alt']) {
    if (!meta[k]) throw new Error(`${file}: missing "${k}:"`);
  }
  meta.body = raw.slice(i).replace(/^\n---[^\n]*\n/, '').trim();
  const [w, h] = meta['image-size'].split('x');
  meta.w = w; meta.h = h;
  return meta;
}

function bodyHtml(body) {
  return body.split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(l => l.trimEnd());
    if (lines.every(l => /^- /.test(l))) return `<ul>\n${lines.map(l => `  <li>${inline(l.slice(2))}</li>`).join('\n')}\n</ul>`;
    if (/^## /.test(lines[0])) return `<h3>${inline(lines[0].slice(3))}</h3>`;
    if (/^> /.test(lines[0])) return `<blockquote>${inline(lines.map(l => l.replace(/^> ?/, '')).join(' '))}</blockquote>`;
    return `<p>${inline(lines.join(' '))}</p>`;
  }).join('\n');
}

const longDate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const indent = (s, n) => s.split('\n').map(l => ' '.repeat(n) + l).join('\n');

function seoHead({ title, description, urlPath, image, type, prefix, extra = '' }) {
  const abs = p => SITE_URL + '/' + p;
  let h = `<title>${esc(title)}</title>\n  <meta name="description" content="${esc(description)}">`;
  if (SITE_URL) {
    h += `\n  <link rel="canonical" href="${abs(urlPath)}">`;
    h += `\n  <meta property="og:type" content="${type}">`;
    h += `\n  <meta property="og:site_name" content="${SITE_NAME}">`;
    h += `\n  <meta property="og:title" content="${esc(title)}">`;
    h += `\n  <meta property="og:description" content="${esc(description)}">`;
    h += `\n  <meta property="og:url" content="${abs(urlPath)}">`;
    if (image) h += `\n  <meta property="og:image" content="${abs(image)}">`;
    h += `\n  <meta name="twitter:card" content="summary_large_image">`;
  }
  return h + extra;
}

function page({ seo, main, prefix, current, cream }) {
  return template
    .replace('bg-fixed__green"', cream ? 'bg-fixed__green is-cream"' : 'bg-fixed__green"')
    .replace('{{SEO}}', () => seo)
    .replace('{{MAIN}}', () => main)
    .replace(/\{\{P\}\}/g, prefix)
    .replace(/\{\{CUR\}\}/g, current ? 'aria-current="page"' : '');
}

const posts = fs.readdirSync(path.join(root, 'posts'))
  .filter(f => f.endsWith('.txt'))
  .sort()
  .map(f => parse(path.join(root, 'posts', f)))
  .sort((a, b) => b.date.localeCompare(a.date));

const slugs = new Set();
posts.forEach(p => { if (slugs.has(p.slug)) throw new Error(`Duplicate slug: ${p.slug}`); slugs.add(p.slug); });

const cta = `        <aside class="blog-cta">
          <h3>Want early access to Honors?</h3>
          <p>Be among the first to play Honors with your mates.</p>
          <a class="btn" href="{{P}}index.html#signup">Sign up for early access</a>
        </aside>`;

const metaRow = p => `<div class="post__meta"><span class="tag">${esc(p.tag)}</span><time datetime="${p.date}">${longDate(p.date)}</time><span>· ${esc(p.read)}</span></div>`;
const media = (p, prefix) => `<div class="post__media"><img src="${prefix}${esc(p.image)}" alt="${esc(p['image-alt'])}" width="${p.w}" height="${p.h}"></div>`;

// ---- blog.html (list) ----
const listMain = `    <section class="page-hero" data-theme="dark" aria-labelledby="blog-title">
      <h1 id="blog-title">From the course</h1>
      <p>Stories, tips and ideas for getting more out of every round with your mates.</p>
    </section>

    <section class="blog" aria-label="Articles">
      <div class="container">

${posts.map(p => `        <article class="post" id="${p.slug}">
          ${media(p, '')}
          ${metaRow(p)}
          <h2><a href="blog/${p.slug}.html">${esc(p.title)}</a></h2>
          <div class="post__body">
            <p>${esc(p.description)}</p>
            <p><a href="blog/${p.slug}.html">Read the article →</a></p>
          </div>
        </article>`).join('\n\n')}

${cta}
      </div>
    </section>`;

const listLd = SITE_URL ? `\n  <script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Blog', name: 'From the course', url: SITE_URL + '/blog.html',
  blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE_URL}/blog/${p.slug}.html`, datePublished: p.date }))
})}</script>` : '';

fs.writeFileSync(path.join(root, 'blog.html'), page({
  seo: seoHead({
    title: 'From the course – Honors',
    description: 'Tips, stories and ideas from the course: formats, friendly bets and getting more out of your rounds with Honors.',
    urlPath: 'blog.html', type: 'website', prefix: '', extra: listLd
  }),
  main: listMain.replace(/\{\{P\}\}/g, ''), prefix: '', current: true
}));

// ---- blog/<slug>.html ----
fs.mkdirSync(path.join(root, 'blog'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'blog'))) {
  if (f.endsWith('.html') && !slugs.has(f.slice(0, -5))) fs.unlinkSync(path.join(root, 'blog', f)); // removed posts
}
for (const p of posts) {
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description,
    datePublished: p.date, dateModified: p.date, author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    ...(SITE_URL ? { image: `${SITE_URL}/${p.image}`, mainEntityOfPage: `${SITE_URL}/blog/${p.slug}.html` } : {})
  });
  const main = `    <section class="page-hero" data-theme="dark" aria-labelledby="post-title">
      <h1 id="post-title">${esc(p.title)}</h1>
      <p>${esc(p.description)}</p>
    </section>

    <section class="blog" aria-label="Article">
      <div class="container">

        <nav aria-label="Breadcrumb"><a href="../blog.html">← From the course</a></nav>

        <article class="post" id="${p.slug}">
          ${media(p, '../')}
          ${metaRow(p)}
          <div class="post__body">
${indent(bodyHtml(p.body), 12)}
          </div>
        </article>

${cta}
      </div>
    </section>`;
  fs.writeFileSync(path.join(root, 'blog', `${p.slug}.html`), page({
    seo: seoHead({
      title: p['seo-title'], description: p.description, urlPath: `blog/${p.slug}.html`, image: p.image, type: 'article', prefix: '../',
      extra: `\n  <script type="application/ld+json">${ld}</script>`
    }),
    main, prefix: '../', current: true
  }));
}

// ---- sitemap.xml ----
if (SITE_URL) {
  const urls = [['index.html', null], ['blog.html', null], ['terms.html', null], ...posts.map(p => [`blog/${p.slug}.html`, p.date])];
  fs.writeFileSync(path.join(root, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(([u, d]) => `  <url><loc>${SITE_URL}/${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n') + `\n</urlset>\n`);
}

console.log(`Built blog.html and ${posts.length} post pages${SITE_URL ? ' + sitemap.xml' : ' (set SITE_URL in build.mjs for canonical tags and sitemap)'}.`);
