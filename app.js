(function () {
  "use strict";

  var STRINGS = {
    es: {
      search_ph: "Buscar noticias…",
      daily_edition: "Edición diaria",
      archive: "Archivo de ediciones",
      footer_tag: "Noticias diarias de IA, en inglés y español.",
      edition_of: "Edición del",
      news_count: "noticias",
      no_results: "Sin resultados para tu búsqueda en esta edición.",
      no_editions: "Aún no hay ediciones publicadas.",
      load_error: "No se pudo cargar la edición. Inténtalo de nuevo más tarde."
    },
    en: {
      search_ph: "Search news…",
      daily_edition: "Daily edition",
      archive: "Edition archive",
      footer_tag: "Daily AI news, in English and Spanish.",
      edition_of: "Edition of",
      news_count: "stories",
      no_results: "No results for your search in this edition.",
      no_editions: "No editions published yet.",
      load_error: "Could not load the edition. Please try again later."
    }
  };

  var state = {
    editions: [],
    current: 0,
    query: "",
    lang: "en"
  };

  try {
    var saved = localStorage.getItem("vexa-lang");
    if (saved === "en" || saved === "es") state.lang = saved;
  } catch (e) {}

  // URL param ?lang=es|en overrides saved preference (for shared links).
  try {
    var m = /[?&]lang=(es|en)\b/.exec(location.search);
    if (m) state.lang = m[1];
  } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function S() { return STRINGS[state.lang]; }

  // Get localized text from {es, en} object or plain string.
  function t(obj) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    return obj[state.lang] || obj.es || obj.en || "";
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso + "T12:00:00");
      var locale = state.lang === "en" ? "en-US" : "es-ES";
      return d.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return iso; }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderBody(body) {
    var paras = String(body || "").split(/\n{2,}|\r\n\r\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paras.length) paras = [String(body || "")];
    return paras.map(function (p) { return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>"; }).join("");
  }

  function storyCard(story, dateLabel, index) {
    var images = story.images || [];
    var card = document.createElement("article");
    card.className = "story-card";
    card.dataset.index = String(index);

    var top = document.createElement("div");
    top.className = "card-top";
    if (images[0]) {
      var thumb = document.createElement("img");
      thumb.className = "card-thumb";
      thumb.src = images[0];
      thumb.alt = "";
      thumb.loading = "lazy";
      top.appendChild(thumb);
    }
    var head = document.createElement("div");
    head.className = "card-head";
    var h3 = document.createElement("h3");
    h3.textContent = t(story.title);
    var p = document.createElement("p");
    p.className = "summary";
    p.textContent = t(story.summary);
    head.appendChild(h3);
    head.appendChild(p);
    top.appendChild(head);
    card.appendChild(top);

    var meta = document.createElement("div");
    meta.className = "card-meta";
    meta.textContent = dateLabel;
    card.appendChild(meta);

    var body = document.createElement("div");
    body.className = "article-body";
    body.style.display = "none";
    var html = "";
    if (images[0]) {
      html += '<img class="card-floated" src="' + esc(images[0]) + '" alt="" loading="lazy">';
    }
    var prose = renderBody(t(story.body));
    if (images[1]) {
      var firstClose = prose.indexOf("</p>");
      if (firstClose !== -1) {
        prose = prose.slice(0, firstClose + 4) +
          '<img class="card-floated right" src="' + esc(images[1]) + '" alt="" loading="lazy">' +
          prose.slice(firstClose + 4);
      } else {
        prose += '<img class="card-floated right" src="' + esc(images[1]) + '" alt="" loading="lazy">';
      }
    }
    html += prose;
    body.innerHTML = html;
    card.appendChild(body);

    top.addEventListener("click", function () {
      var expanded = card.classList.toggle("expanded");
      body.style.display = expanded ? "block" : "none";
    });

    return card;
  }

  function filteredStories(ed) {
    var q = state.query.trim().toLowerCase();
    if (!q) return ed.stories;
    return ed.stories.filter(function (s) {
      var hay = (t(s.title) + " " + t(s.summary) + " " + t(s.body)).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function applyI18n() {
    var s = S();
    document.documentElement.lang = state.lang;
    var ph = document.querySelector("[data-i18n-ph]");
    if (ph) ph.placeholder = s.search_ph;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (s[k]) el.textContent = s[k];
    });
    $("lang-es").classList.toggle("active", state.lang === "es");
    $("lang-en").classList.toggle("active", state.lang === "en");
  }

  function render() {
    applyI18n();
    var ed = state.editions[state.current];
    var head = $("edition-head");
    var list = $("stories");

    if (!ed) {
      head.innerHTML = "";
      list.innerHTML = '<div class="empty">' + esc(S().no_editions) + "</div>";
      return;
    }
    renderStories(ed);
  }

  function renderStories(ed) {
    var head = $("edition-head");
    var list = $("stories");
    var dateLabel = formatDate(ed.date);
    head.innerHTML = "<h2>" + esc(S().edition_of) + " " + esc(dateLabel) + "</h2>" +
      "<p>" + ed.stories.length + " " + esc(S().news_count) + "</p>";

    var stories = filteredStories(ed);
    list.innerHTML = "";
    if (!stories.length) {
      list.innerHTML = '<div class="empty">' + esc(S().no_results) + "</div>";
      return;
    }
    stories.forEach(function (s, i) { list.appendChild(storyCard(s, dateLabel, i)); });
  }

  function renderArchive() {
    var ul = $("archive-list");
    ul.innerHTML = "";
    state.editions.forEach(function (ed, i) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.textContent = formatDate(ed.date) + " (" + ed.stories.length + ")";
      btn.addEventListener("click", function () {
        state.current = i;
        $("edition-select").value = String(i);
        window.scrollTo({ top: 0, behavior: "smooth" });
        render();
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });

    var sel = $("edition-select");
    sel.innerHTML = "";
    state.editions.forEach(function (ed, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = formatDate(ed.date);
      sel.appendChild(opt);
    });
    sel.value = String(state.current);
  }

  function loadEditionImages(ed) {
    var base = "editions/" + ed.date;
    return Promise.all([
      fetch(base + "-img-hero.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(base + "-img-inline.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      var hero = (res[0] && res[0].images) || [];
      var inline = (res[1] && res[1].images) || [];
      ed.stories.forEach(function (s, i) {
        var imgs = [];
        if (hero[i]) imgs.push(hero[i]);
        if (inline[i]) imgs.push(inline[i]);
        if (imgs.length) s.images = imgs;
      });
      return ed;
    });
  }

  function setLang(lang) {
    if (lang !== "es" && lang !== "en") return;
    state.lang = lang;
    try { localStorage.setItem("vexa-lang", lang); } catch (e) {}
    render();
    renderArchive();
    $("today-date").textContent = formatDate(new Date().toISOString().slice(0, 10));
  }

  function load() {
    $("today-date").textContent = formatDate(new Date().toISOString().slice(0, 10));

    fetch("editions/index.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("index"); return r.json(); })
      .then(function (idx) {
        var dates = (idx.editions || []).slice().sort().reverse();
        return Promise.all(dates.map(function (d) {
          return fetch("editions/" + d + ".json", { cache: "no-store" })
            .then(function (r) { if (!r.ok) throw new Error(d); return r.json(); })
            .then(loadEditionImages)
            .catch(function () { return { date: d, stories: [] }; });
        }));
      })
      .then(function (eds) {
        state.editions = eds;
        state.current = 0;
        renderArchive();
        render();
      })
      .catch(function () {
        $("stories").innerHTML = '<div class="empty">' + esc(S().load_error) + "</div>";
      });

    $("search").addEventListener("input", function (e) {
      state.query = e.target.value;
      render();
    });
    $("edition-select").addEventListener("change", function (e) {
      state.current = parseInt(e.target.value, 10) || 0;
      window.scrollTo({ top: 0, behavior: "smooth" });
      render();
    });
    $("lang-es").addEventListener("click", function () { setLang("es"); });
    $("lang-en").addEventListener("click", function () { setLang("en"); });
  }

  document.addEventListener("DOMContentLoaded", load);
})();
