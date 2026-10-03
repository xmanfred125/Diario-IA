(function () {
  "use strict";

  var state = {
    editions: [],        // [{date, stories:[...]}] newest first
    current: 0,          // index into editions
    query: ""
  };

  function $(id) { return document.getElementById(id); }

  function formatDate(iso) {
    try {
      var d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return iso; }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Turn plain-text body into paragraphs. Keeps "Qué pasó / Por qué importa" markers as kickers.
  function renderBody(body) {
    var paras = String(body || "").split(/\n{2,}|\r\n\r\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paras.length) paras = [String(body || "")];
    return paras.map(function (p) {
      var m = p.match(/^(Qué pasó|Por qué importa|Detalles clave|Contexto)\s*[:\-–]\s*(.*)$/i);
      if (m) {
        return '<p><span class="card-kicker">' + esc(m[1]) + '</span><br>' + esc(m[2]) + "</p>";
      }
      return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function storyCard(story, dateLabel) {
    var images = story.images || [];
    var details = document.createElement("details");
    details.className = "card";

    // --- Collapsed header: thumbnail + title/summary side by side ---
    var summary = document.createElement("summary");
    if (images[0]) {
      var thumb = document.createElement("img");
      thumb.className = "card-thumb";
      thumb.src = images[0];
      thumb.alt = "";
      thumb.loading = "lazy";
      summary.appendChild(thumb);
    }
    var text = document.createElement("div");
    text.className = "card-text";
    var h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = story.title;
    var p = document.createElement("p");
    p.className = "card-summary";
    p.textContent = story.summary;
    text.appendChild(h3);
    text.appendChild(p);
    summary.appendChild(text);

    // --- Expanded body: floated images + prose (newspaper style) ---
    var body = document.createElement("div");
    body.className = "card-body";
    var html = "";
    if (images[0]) {
      html += '<img class="card-floated" src="' + esc(images[0]) + '" alt="" loading="lazy">';
    }
    var prose = renderBody(story.body);
    if (images[1]) {
      // Second image after the first paragraph.
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
    html += '<p class="card-edition-note">Edición del ' + esc(dateLabel) + "</p>";
    // Clear floats
    html += '<div style="clear:both"></div>';
    body.innerHTML = html;

    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  function filteredStories(ed) {
    var q = state.query.trim().toLowerCase();
    if (!q) return ed.stories;
    return ed.stories.filter(function (s) {
      return (s.title + " " + s.summary + " " + s.body).toLowerCase().indexOf(q) !== -1;
    });
  }

  function ensureThumbs(ed, done) {
    if (!ed || ed._thumbsLoaded) { done(); return; }
    ed._thumbsLoaded = true;
    fetch("editions/" + ed.date + "-thumbs.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("thumbs"); return r.json(); })
      .then(function (tj) {
        (tj.images || []).forEach(function (imgs, i) {
          if (ed.stories[i]) ed.stories[i].images = imgs;
        });
        done();
      })
      .catch(function () { done(); });
  }

  function render() {
    var ed = state.editions[state.current];
    var head = $("edition-head");
    var list = $("stories");

    if (!ed) {
      head.innerHTML = "";
      list.innerHTML = '<div class="empty">Aún no hay ediciones publicadas.</div>';
      return;
    }

    ensureThumbs(ed, function () { renderStories(ed); });
  }

  function renderStories(ed) {
    var head = $("edition-head");
    var list = $("stories");
    var dateLabel = formatDate(ed.date);
    head.innerHTML = "<h2>Edición del " + esc(dateLabel) + "</h2>" +
      "<p>" + ed.stories.length + " noticias</p>";

    var stories = filteredStories(ed);
    list.innerHTML = "";
    if (!stories.length) {
      list.innerHTML = '<div class="empty">Sin resultados para tu búsqueda en esta edición.</div>';
      return;
    }
    stories.forEach(function (s) { list.appendChild(storyCard(s, dateLabel)); });
  }

  function renderArchive() {
    var ul = $("archive-list");
    ul.innerHTML = "";
    state.editions.forEach(function (ed, i) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.innerHTML = "<span>" + esc(formatDate(ed.date)) + '</span><span class="count">' +
        ed.stories.length + " noticias</span>";
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

  function load() {
    $("today-date").textContent = formatDate(new Date().toISOString().slice(0, 10));

    fetch("editions/index.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("index"); return r.json(); })
      .then(function (idx) {
        var dates = (idx.editions || []).slice().sort().reverse();
        return Promise.all(dates.map(function (d) {
          return fetch("editions/" + d + ".json", { cache: "no-store" })
            .then(function (r) { if (!r.ok) throw new Error(d); return r.json(); })
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
        $("stories").innerHTML = '<div class="empty">No se pudo cargar la edición. Inténtalo de nuevo más tarde.</div>';
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
  }

  document.addEventListener("DOMContentLoaded", load);
})();
