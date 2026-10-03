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
    var details = document.createElement("details");
    details.className = "card";
    var summary = document.createElement("summary");
    var h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = story.title;
    var p = document.createElement("p");
    p.className = "card-summary";
    p.textContent = story.summary;
    summary.appendChild(h3);
    summary.appendChild(p);
    var body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = renderBody(story.body) +
      '<p style="color:var(--muted);font-size:0.82rem;margin-top:0.9rem">Edición del ' + esc(dateLabel) + "</p>";
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

  function render() {
    var ed = state.editions[state.current];
    var head = $("edition-head");
    var list = $("stories");

    if (!ed) {
      head.innerHTML = "";
      list.innerHTML = '<div class="empty">Aún no hay ediciones publicadas.</div>';
      return;
    }

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
