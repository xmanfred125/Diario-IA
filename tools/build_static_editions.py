#!/usr/bin/env python3
"""Genera páginas HTML estáticas por edición del diario Vexa Times.

Lee editions/index.json + editions/<fecha>.json y genera:
  - ediciones/<fecha>.html   (una URL indexable por día, bilingüe ES/EN)
  - ediciones/index.html      (archivo de ediciones)
  - sitemap.xml               (todas las URLs del sitio)
  - robots.txt                (permite rastreo + apunta al sitemap)

Idempotente: regenera todo en cada ejecución. Pensado para correr a diario
desde el cron de video (10:00) después de que el diario publique la edición.
"""
import html
import json
import os
import sys
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://vexatimes.com"
PUB_ID = "ca-pub-5608405077610768"

ADSENSE_SNIPPET = (
    '<script async src="https://pagead2.googlesyndication.com/pagead/js/'
    f'adsbygoogle.js?client={PUB_ID}"\n'
    '     crossorigin="anonymous"></script>'
)


def esc(s):
    return html.escape(s or "", quote=True)


def pick(d, lang):
    """Toma el texto en el idioma pedido de un dict {es,en} o string."""
    if d is None:
        return ""
    if isinstance(d, str):
        return d
    return d.get(lang) or d.get("es") or d.get("en") or ""


def story_html(story, lang):
    title = esc(pick(story.get("title"), lang))
    summary = esc(pick(story.get("summary"), lang))
    body = pick(story.get("body"), lang)
    paras = "\n".join(
        f"    <p>{esc(p.strip())}</p>"
        for p in body.split("\n") if p.strip()
    ) or f"    <p>{summary}</p>"
    sdate = esc(story.get("date") or "")
    return (
        f'  <article class="story">\n'
        f'    <h2>{title}</h2>\n'
        f'    <p class="lede">{summary}</p>\n'
        f'{paras}\n'
        f'    <p class="story-date">{sdate}</p>\n'
        f'  </article>\n'
    )


def edition_page(ed_date, edition, prev_date, next_date):
    stories = edition.get("stories", [])
    lead = stories[0] if stories else {}
    lead_title_es = pick(lead.get("title"), "es")
    lead_title_en = pick(lead.get("title"), "en")
    desc_es = (pick(lead.get("summary"), "es") or "")[:160]
    url = f"{SITE}/ediciones/{ed_date}.html"

    def nav(d, label):
        if not d:
            return '<span class="nav-empty"></span>'
        return f'<a class="nav-link" href="{d}.html">{label} {d}</a>'

    es_blocks = "\n".join(story_html(s, "es") for s in stories)
    en_blocks = "\n".join(story_html(s, "en") for s in stories)

    ld = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": lead_title_es or lead_title_en,
        "datePublished": ed_date,
        "inLanguage": ["es", "en"],
        "publisher": {
            "@type": "Organization",
            "name": "Vexa Times",
            "url": SITE,
        },
        "mainEntityOfPage": url,
    }

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(lead_title_es)} | Vexa Times</title>
<meta name="description" content="{esc(desc_es)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(lead_title_es)} | Vexa Times">
<meta property="og:description" content="{esc(desc_es)}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Vexa Times">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../styles.css">
{ADSENSE_SNIPPET}
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
</script>
<style>
.edition-nav {{ display:flex; justify-content:space-between; gap:1rem; margin:1.2rem 0; flex-wrap:wrap; }}
.nav-link, .nav-empty {{ padding:.4rem .8rem; }}
.lang-jump {{ margin:1rem 0; font-size:.95rem; }}
.story {{ margin-bottom:2.2rem; }}
.story .lede {{ font-weight:bold; }}
.story .story-date {{ color:#777; font-size:.85rem; }}
.edition-h {{ margin-top:0; }}
</style>
</head>
<body>
<header class="masthead">
  <div class="masthead-inner">
    <a href="../index.html" style="color:inherit;text-decoration:none;"><strong>Vexa Times</strong></a>
    <div class="masthead-meta"><span>Edición del {esc(ed_date)}</span><span class="dot"> · </span><span>Noticias diarias de IA</span></div>
  </div>
</header>
<main class="content">
  <nav class="edition-nav">
    {nav(prev_date, "← Edición anterior:")}
    <a class="nav-link" href="../index.html">Portada</a>
    {nav(next_date, "Edición siguiente: →")}
  </nav>
  <h1 class="edition-h">Las noticias de IA del {esc(ed_date)}</h1>
  <p class="lang-jump"><a href="#english">English version below ↓</a> · <a href="index.html">Archivo de ediciones</a></p>
  <section id="espanol">
{es_blocks}  </section>
  <hr>
  <section id="english" lang="en">
    <h1>AI news for {esc(ed_date)}</h1>
{en_blocks}  </section>
  <nav class="edition-nav">
    {nav(prev_date, "← Edición anterior:")}
    <a class="nav-link" href="index.html">Archivo de ediciones</a>
    {nav(next_date, "Edición siguiente: →")}
  </nav>
</main>
<footer style="text-align:center;padding:2rem 1rem;color:#777;font-size:.9rem;">
  <a href="../privacy-policy.html">Privacidad</a> · <a href="../terms.html">Términos</a> · <a href="../contact.html">Contacto</a>
</footer>
</body>
</html>
"""


def archive_page(dates):
    items = "\n".join(
        f'    <li><a href="{d}.html">Edición del {d} — AI news edition</a></li>'
        for d in sorted(dates, reverse=True)
    )
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Archivo de ediciones | Vexa Times</title>
<meta name="description" content="Archivo completo de las ediciones diarias de Vexa Times: noticias de inteligencia artificial en español e inglés.">
<link rel="canonical" href="{SITE}/ediciones/index.html">
<link rel="stylesheet" href="../styles.css">
{ADSENSE_SNIPPET}
</head>
<body>
<header class="masthead">
  <div class="masthead-inner">
    <a href="../index.html" style="color:inherit;text-decoration:none;"><strong>Vexa Times</strong></a>
    <div class="masthead-meta"><span>Archivo de ediciones</span></div>
  </div>
</header>
<main class="content">
  <h1>Archivo de ediciones</h1>
  <ul>
{items}
  </ul>
  <p><a href="../index.html">← Volver a la portada</a></p>
</main>
</body>
</html>
"""


def main():
    editions_dir = os.path.join(REPO, "editions")
    out_dir = os.path.join(REPO, "ediciones")
    os.makedirs(out_dir, exist_ok=True)

    with open(os.path.join(editions_dir, "index.json"), encoding="utf-8") as f:
        dates = sorted(json.load(f).get("editions", []))

    pages = []
    for i, d in enumerate(dates):
        path = os.path.join(editions_dir, f"{d}.json")
        if not os.path.exists(path):
            print(f"aviso: falta {path}, se omite", file=sys.stderr)
            continue
        with open(path, encoding="utf-8") as f:
            edition = json.load(f)
        prev_d = dates[i - 1] if i > 0 else None
        next_d = dates[i + 1] if i + 1 < len(dates) else None
        with open(os.path.join(out_dir, f"{d}.html"), "w", encoding="utf-8") as f:
            f.write(edition_page(d, edition, prev_d, next_d))
        pages.append((d, f"ediciones/{d}.html"))
        print(f"generada ediciones/{d}.html ({len(edition.get('stories', []))} noticias)")

    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(archive_page(dates))
    print("generado ediciones/index.html")

    # sitemap.xml
    static_pages = [
        ("index.html", str(date.today())),
        ("ediciones/index.html", str(date.today())),
        ("privacy-policy.html", "2026-10-07"),
        ("terms.html", "2026-10-07"),
        ("contact.html", "2026-10-07"),
        ("carrera.html", "2026-10-14"),
    ]
    urls = "\n".join(
        f"  <url><loc>{SITE}/{p}</loc><lastmod>{lm}</lastmod></url>"
        for p, lm in static_pages
    )
    urls += "\n" + "\n".join(
        f"  <url><loc>{SITE}/{p}</loc><lastmod>{d}</lastmod></url>"
        for d, p in pages
    )
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{urls}\n"
        "</urlset>\n"
    )
    with open(os.path.join(REPO, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap)
    print(f"sitemap.xml con {len(static_pages) + len(pages)} URLs")

    robots = f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n"
    with open(os.path.join(REPO, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(robots)
    print("robots.txt generado")


if __name__ == "__main__":
    main()
