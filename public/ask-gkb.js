/* Ask GKB — site-only deterministic FAQ search with chat UX.
 * No LLM, no backend. MiniSearch BM25 over public/ask/qa.json.
 * Renders a floating launcher on every page (hidden on /ask/) and a modal chat.
 * The /ask/ page mounts the same logic inline without the launcher.
 */
(function () {
  if (window.__ASK_GKB_INIT) return;
  window.__ASK_GKB_INIT = true;

  var BASE = "";
  var QA_URL = "/ask/qa.json";
  var MS_URL = "https://cdn.jsdelivr.net/npm/minisearch@7.1.0/dist/umd/index.min.js";

  var state = {
    miniSearch: null,
    qa: null,
    qaById: null,
    loading: false,
    history: [],   // array of { role, text, meta }
    inlineMode: false, // true on /ask/ page
  };

  /* ------------------------------------------------------------------ *
   * GA4 events
   * ------------------------------------------------------------------ */
  function track(name, params) {
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", name, params || {});
      }
    } catch (e) { /* noop */ }
  }

  /* ------------------------------------------------------------------ *
   * Topic intelligence — prefixes, thinking copy, follow-up pills
   * ------------------------------------------------------------------ */
  var THINKING = {
    construction: ["Checking GKB's data on construction costs…", "Pulling up our construction benchmarks…"],
    loan: ["Pulling GKB's loan research…", "Checking what the banks actually do…"],
    "stamp-duty": ["Looking up state stamp duty rates…", "Checking the IGR data…"],
    plot: ["Reviewing GKB's plot analysis…", "Pulling our plot-viability data…"],
    interior: ["Checking GKB's renovation benchmarks…", "Looking at our interior cost data…"],
    kitchen: ["Pulling our modular-kitchen data…"],
    bathroom: ["Checking bathroom renovation benchmarks…"],
    pmay: ["Looking up PMAY 2.0 eligibility rules…"],
    ltcg: ["Pulling GKB's LTCG playbook…"],
    "rental-yield": ["Reviewing GKB's rental-yield data…"],
    contractor: ["Checking the contractor BOQ playbook…"],
    redevelopment: ["Looking up DCPR 2034 redevelopment data…"],
    _default: ["Searching GKB's database…", "Looking that up in our data…"],
  };

  var PREFIXES = {
    construction: "Based on GKB's construction data, here's how it breaks down:",
    loan: "On the loan side, here's what GKB's research shows:",
    "stamp-duty": "Stamp duty works state-by-state. Here's the relevant detail:",
    plot: "From GKB's plot-purchase analysis, here's what we found:",
    interior: "On the interior side, here's GKB's take:",
    kitchen: "On modular kitchens, here's what we've benchmarked:",
    bathroom: "On bathroom renovation, here's what GKB's data shows:",
    pmay: "On PMAY 2.0, here's the rule that applies:",
    ltcg: "On LTCG and property tax, here's the relevant detail:",
    "rental-yield": "On rental yield, here's what GKB's data shows:",
    contractor: "On contractor quotes, here's our playbook:",
    redevelopment: "On redevelopment, here's what GKB has documented:",
    _default: "Here's what GKB's data says:",
  };

  // Map of tag-priority → followup pills (calc + article + adjacent topic)
  var FOLLOWUPS = {
    construction: [
      { label: "Try the Construction Calculator", url: "/construction/" },
      { label: "Read the 1000 sqft cost breakdown", url: "/articles/1000-sqft-house-construction-cost-2026/" },
      { label: "Check home loan eligibility", url: "/home-loan-eligibility/" },
    ],
    "construction+mumbai": [
      { label: "Open Construction Calculator", url: "/construction/" },
      { label: "Mumbai cost guide 2026", url: "/articles/construction-cost-mumbai-2026/" },
      { label: "Mumbai stamp duty", url: "/stamp-duty/" },
    ],
    "construction+pune": [
      { label: "Open Construction Calculator", url: "/construction/" },
      { label: "Pune cost guide 2026", url: "/articles/construction-cost-pune-2026/" },
      { label: "Plot viability check", url: "/plot-viability/" },
    ],
    "construction+bangalore": [
      { label: "Open Construction Calculator", url: "/construction/" },
      { label: "Bangalore cost guide 2026", url: "/articles/construction-cost-bangalore-2026/" },
      { label: "Karnataka stamp duty", url: "/stamp-duty/" },
    ],
    loan: [
      { label: "Try the EMI Calculator", url: "/emi/" },
      { label: "Check eligibility", url: "/home-loan-eligibility/" },
      { label: "Read why loans get rejected", url: "/articles/home-loan-rejection-reasons-2026/" },
    ],
    "loan+balance-transfer": [
      { label: "Balance Transfer Calculator", url: "/balance-transfer/" },
      { label: "Read when BT is worth it", url: "/articles/home-loan-balance-transfer-2026/" },
      { label: "EMI Calculator", url: "/emi/" },
    ],
    "loan+prepay": [
      { label: "Prepay vs SIP Calculator", url: "/prepay-vs-sip/" },
      { label: "EMI Calculator", url: "/emi/" },
      { label: "Home loan eligibility", url: "/home-loan-eligibility/" },
    ],
    pmay: [
      { label: "PMAY 2.0 Eligibility Checker", url: "/pmay-eligibility/" },
      { label: "Read PMAY 2.0 explained", url: "/articles/pmay-2-0-explained-2026/" },
      { label: "Home loan eligibility", url: "/home-loan-eligibility/" },
    ],
    "stamp-duty": [
      { label: "Stamp Duty Calculator", url: "/stamp-duty/" },
      { label: "Plot Viability", url: "/plot-viability/" },
      { label: "Read about carpet vs built-up", url: "/articles/carpet-built-up-india/" },
    ],
    plot: [
      { label: "Plot Viability Calculator", url: "/plot-viability/" },
      { label: "Read plot vs flat", url: "/articles/plot-vs-flat-2026/" },
      { label: "Stamp Duty", url: "/stamp-duty/" },
    ],
    interior: [
      { label: "Interior Cost Estimator", url: "/interior/" },
      { label: "Modular Kitchen Calculator", url: "/modular-kitchen/" },
      { label: "Painting Cost Calculator", url: "/painting-cost/" },
    ],
    kitchen: [
      { label: "Modular Kitchen Calculator", url: "/modular-kitchen/" },
      { label: "Read kitchen price guide", url: "/articles/modular-kitchen-price-india-2026/" },
      { label: "Interior Cost Estimator", url: "/interior/" },
    ],
    bathroom: [
      { label: "Bathroom Renovation Calculator", url: "/bathroom-renovation/" },
      { label: "Waterproofing Calculator", url: "/waterproofing/" },
      { label: "Painting Calculator", url: "/painting-cost/" },
    ],
    painting: [
      { label: "Painting Cost Calculator", url: "/painting-cost/" },
      { label: "Interior Estimator", url: "/interior/" },
      { label: "False ceiling cost guide", url: "/articles/false-ceiling-cost-india/" },
    ],
    waterproofing: [
      { label: "Waterproofing Calculator", url: "/waterproofing/" },
      { label: "Bathroom Renovation", url: "/bathroom-renovation/" },
      { label: "Read hidden costs guide", url: "/articles/house-construction-hidden-costs-india/" },
    ],
    contractor: [
      { label: "Quote Checker", url: "/quote-check/" },
      { label: "Read the BOQ guide", url: "/articles/how-to-read-contractor-boq/" },
      { label: "5 contractor red flags", url: "/articles/contractor-quote-red-flags/" },
    ],
    ltcg: [
      { label: "LTCG Calculator", url: "/ltcg-property/" },
      { label: "Read the LTCG playbook", url: "/articles/ltcg-property-sale-2026-playbook/" },
      { label: "Rental Yield Calculator", url: "/rental-yield/" },
    ],
    "rental-yield": [
      { label: "Rental Yield Calculator", url: "/rental-yield/" },
      { label: "Read the yield reality check", url: "/articles/rental-yield-reality-india-2026/" },
      { label: "Plot Viability", url: "/plot-viability/" },
    ],
    rent: [
      { label: "EMI vs Rent Calculator", url: "/emi-vs-rent/" },
      { label: "Rental Yield Calculator", url: "/rental-yield/" },
      { label: "Home loan eligibility", url: "/home-loan-eligibility/" },
    ],
    redevelopment: [
      { label: "Redevelopment Calculator", url: "/society-redevelopment/" },
      { label: "Read the Mumbai redev guide", url: "/articles/mumbai-society-redevelopment-2026/" },
      { label: "LTCG Calculator", url: "/ltcg-property/" },
    ],
    _default: [
      { label: "Explore all calculators", url: "/" },
      { label: "Browse articles", url: "/articles/" },
      { label: "Read methodology", url: "/methodology/" },
    ],
  };

  function pickPrefix(tags) {
    for (var i = 0; i < tags.length; i++) {
      if (PREFIXES[tags[i]]) return PREFIXES[tags[i]];
    }
    return PREFIXES._default;
  }

  function pickThinking(tags) {
    for (var i = 0; i < tags.length; i++) {
      if (THINKING[tags[i]]) {
        var arr = THINKING[tags[i]];
        return arr[Math.floor(Math.random() * arr.length)];
      }
    }
    var def = THINKING._default;
    return def[Math.floor(Math.random() * def.length)];
  }

  function pickFollowups(tags) {
    // Try tag pairs first (e.g. construction+mumbai)
    for (var i = 0; i < tags.length; i++) {
      for (var j = 0; j < tags.length; j++) {
        if (i === j) continue;
        var key = tags[i] + "+" + tags[j];
        if (FOLLOWUPS[key]) return FOLLOWUPS[key];
      }
    }
    // Then single tags
    for (var k = 0; k < tags.length; k++) {
      if (FOLLOWUPS[tags[k]]) return FOLLOWUPS[tags[k]];
    }
    return FOLLOWUPS._default;
  }

  /* ------------------------------------------------------------------ *
   * Lazy loaders
   * ------------------------------------------------------------------ */
  function loadScript(url) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = res;
      s.onerror = function () { rej(new Error("Failed to load " + url)); };
      document.head.appendChild(s);
    });
  }

  function loadJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Failed to fetch " + url);
      return r.json();
    });
  }

  function ensureSearchReady() {
    if (state.miniSearch && state.qa) return Promise.resolve();
    if (state.loading) {
      return new Promise(function (res) {
        var t = setInterval(function () {
          if (state.miniSearch && state.qa) { clearInterval(t); res(); }
        }, 50);
      });
    }
    state.loading = true;
    return Promise.all([
      loadScript(MS_URL),
      loadJSON(QA_URL),
    ]).then(function (results) {
      var qa = results[1];
      var MS = window.MiniSearch;
      var ms = new MS({
        fields: ["q", "tags", "a"],
        storeFields: ["q", "a", "source", "source_title", "tags", "lang"],
        searchOptions: {
          boost: { q: 3, tags: 2, a: 1 },
          fuzzy: 0.2,
          prefix: true,
        },
      });
      // Assign integer IDs
      qa.forEach(function (e, i) { e.id = i; });
      ms.addAll(qa);
      state.miniSearch = ms;
      state.qa = qa;
      state.loading = false;
    });
  }

  /* ------------------------------------------------------------------ *
   * Matching + threshold
   * ------------------------------------------------------------------ */
  var THRESHOLD = 135; // empirically tuned May 2026 — keeps nonsense queries off the confident path while letting low-score legit hits surface via the related-links fallback

  function matchQuery(query) {
    var results = state.miniSearch.search(query);
    if (!results.length) {
      return { kind: "no_match", related: [] };
    }
    var top = results[0];
    if (top.score >= THRESHOLD) {
      return {
        kind: "match",
        primary: top,
        score: top.score,
        related: results.slice(1, 4),
      };
    }
    return { kind: "no_match", related: results.slice(0, 3) };
  }

  /* ------------------------------------------------------------------ *
   * Streaming text animation
   * ------------------------------------------------------------------ */
  function streamText(el, text, done) {
    var i = 0;
    var n = text.length;
    var perChar = 18; // ms — slightly faster on longer answers
    if (n > 400) perChar = 10;
    if (n > 800) perChar = 6;
    function step() {
      if (i >= n) { if (done) done(); return; }
      // Append a chunk for performance — 3 chars per tick
      var next = Math.min(i + 3, n);
      el.textContent = text.slice(0, next);
      i = next;
      setTimeout(step, perChar);
    }
    step();
  }

  /* ------------------------------------------------------------------ *
   * Render helpers
   * ------------------------------------------------------------------ */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function escapeHTML(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderUser(container, text) {
    var row = el("div", "askg-row askg-row--user");
    var bubble = el("div", "askg-bubble askg-bubble--user");
    bubble.textContent = text;
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  function renderThinking(container, tags) {
    var row = el("div", "askg-row askg-row--ai");
    var bubble = el("div", "askg-bubble askg-bubble--ai askg-thinking");
    bubble.innerHTML = '<span class="askg-dots"><span></span><span></span><span></span></span><span class="askg-thinking-text"></span>';
    bubble.querySelector(".askg-thinking-text").textContent = pickThinking(tags);
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return row;
  }

  function renderAnswer(container, result, query) {
    var row = el("div", "askg-row askg-row--ai");
    var bubble = el("div", "askg-bubble askg-bubble--ai");

    if (result.kind === "match") {
      var match = result.primary;
      var tags = match.tags || [];
      var prefix = pickPrefix(tags);

      var prefixEl = el("p", "askg-prefix");
      prefixEl.textContent = prefix;
      bubble.appendChild(prefixEl);

      var qEl = el("p", "askg-q");
      qEl.textContent = "Q: " + match.q;
      bubble.appendChild(qEl);

      var aEl = el("p", "askg-a");
      bubble.appendChild(aEl);

      var srcDivider = el("div", "askg-divider");
      bubble.appendChild(srcDivider);

      var srcEl = el("div", "askg-source");
      srcEl.innerHTML = 'Source: <a href="' + match.source + '" data-askg-src="' + match.source + '">' +
        escapeHTML(match.source_title) + ' &rarr;</a>';
      bubble.appendChild(srcEl);

      var pills = pickFollowups(tags);
      var pillRow = el("div", "askg-pills");
      pills.forEach(function (p) {
        var a = el("a", "askg-pill");
        a.href = p.url;
        a.textContent = p.label + " →";
        a.setAttribute("data-askg-followup", p.url);
        a.setAttribute("data-askg-label", p.label);
        pillRow.appendChild(a);
      });
      bubble.appendChild(pillRow);

      row.appendChild(bubble);
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;

      // Stream the answer text
      streamText(aEl, match.a, function () {
        container.scrollTop = container.scrollHeight;
      });

      // Wire click tracking
      bubble.querySelectorAll("[data-askg-src]").forEach(function (a) {
        a.addEventListener("click", function () {
          track("ask_source_click", { query: query, source: a.getAttribute("data-askg-src") });
        });
      });
      bubble.querySelectorAll("[data-askg-followup]").forEach(function (a) {
        a.addEventListener("click", function () {
          track("ask_followup_click", {
            query: query,
            followup_url: a.getAttribute("data-askg-followup"),
            followup_label: a.getAttribute("data-askg-label"),
          });
        });
      });

      track("ask_match", {
        query: query,
        matched_q: match.q,
        source: match.source,
        match_score: Math.round(match.score * 10) / 10,
      });
    } else {
      // No match — graceful fallback
      var pEl = el("p", "askg-prefix");
      pEl.textContent = "We don't have a direct answer to that yet. But these GKB pages cover related ground:";
      bubble.appendChild(pEl);

      var relList = el("ul", "askg-related");
      var picks = (result.related && result.related.length)
        ? result.related.slice(0, 3)
        : [];
      // Ensure at least 2 calculator/article suggestions even when zero matches
      var fallbackPills = FOLLOWUPS._default;
      if (picks.length === 0) {
        fallbackPills.forEach(function (p) {
          var li = el("li");
          li.innerHTML = '<a href="' + p.url + '">' + escapeHTML(p.label) + ' &rarr;</a>';
          relList.appendChild(li);
        });
      } else {
        picks.forEach(function (r) {
          var li = el("li");
          li.innerHTML = '<a href="' + r.source + '">' + escapeHTML(r.source_title) + ' &rarr;</a>';
          relList.appendChild(li);
        });
      }
      bubble.appendChild(relList);

      var hintEl = el("p", "askg-nomatch-hint");
      hintEl.innerHTML = 'Or try a calculator: <a href="/">all 18 calculators</a> · <a href="/articles/">all articles</a>';
      bubble.appendChild(hintEl);

      row.appendChild(bubble);
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;

      track("ask_no_match", { query: query });
    }
  }

  /* ------------------------------------------------------------------ *
   * Submit handler — orchestrates thinking → match → render
   * ------------------------------------------------------------------ */
  function handleSubmit(query, container, opts) {
    if (!query || !query.trim()) return;
    var q = query.trim();
    renderUser(container, q);

    // Hinglish heuristic (very crude — Roman-script Hindi function words)
    var lang = /\b(kitna|kitne|kaise|hai|mein|kya|nahi|chahiye|sahi)\b/i.test(q) ? "hinglish" : "en";
    track("ask_query", { query: q, query_length: q.length, language: lang });

    ensureSearchReady().then(function () {
      var result = matchQuery(q);
      var thinkingTags = result.kind === "match" ? (result.primary.tags || []) : [];
      var thinkingRow = renderThinking(container, thinkingTags);

      var delay = 800 + Math.random() * 250;
      setTimeout(function () {
        thinkingRow.remove();
        renderAnswer(container, result, q);
      }, delay);
    }).catch(function (err) {
      var row = el("div", "askg-row askg-row--ai");
      var bubble = el("div", "askg-bubble askg-bubble--ai");
      bubble.innerHTML = '<p>We hit a glitch loading the search index. Try refreshing, or browse <a href="/">all calculators</a>.</p>';
      row.appendChild(bubble);
      container.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------ *
   * Modal markup
   * ------------------------------------------------------------------ */
  function buildModal() {
    var wrap = document.createElement("div");
    wrap.className = "askg-modal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "Ask GKB");
    wrap.innerHTML =
      '<div class="askg-modal-backdrop" data-askg-close></div>' +
      '<div class="askg-modal-panel">' +
      '  <header class="askg-modal-head">' +
      '    <div>' +
      '      <h2>Ask GKB</h2>' +
      '      <p class="askg-sub">Searches GKB\'s own data — no AI guessing</p>' +
      '    </div>' +
      '    <button type="button" class="askg-close" data-askg-close aria-label="Close">×</button>' +
      '  </header>' +
      '  <div class="askg-log" id="askg-log-modal"></div>' +
      '  <form class="askg-form" data-askg-form>' +
      '    <input type="text" class="askg-input" placeholder="Ask about construction cost, loans, stamp duty…" autocomplete="off" aria-label="Your question"/>' +
      '    <button type="submit" class="askg-send" aria-label="Send">Send</button>' +
      '  </form>' +
      '</div>';
    return wrap;
  }

  function openModal(source) {
    var existing = document.querySelector(".askg-modal");
    if (existing) {
      existing.classList.add("askg-modal--open");
      var inp = existing.querySelector(".askg-input");
      if (inp) inp.focus();
      return;
    }
    var m = buildModal();
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add("askg-modal--open"); });
    var log = m.querySelector("#askg-log-modal");
    var form = m.querySelector("[data-askg-form]");
    var input = m.querySelector(".askg-input");

    // Seed greeting
    var greet = el("div", "askg-row askg-row--ai");
    var gb = el("div", "askg-bubble askg-bubble--ai");
    gb.innerHTML = '<p>Hi! Ask anything about Indian home costs, loans, stamp duty, or renovation. Try: <em>"stamp duty in Maharashtra"</em>, <em>"cost to build 2BHK in Pune"</em>, <em>"should I prepay or invest?"</em></p>';
    greet.appendChild(gb);
    log.appendChild(greet);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value;
      input.value = "";
      handleSubmit(q, log, { source: source });
    });

    m.addEventListener("click", function (e) {
      if (e.target.matches("[data-askg-close]")) {
        m.classList.remove("askg-modal--open");
        setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 200);
      }
    });

    track("ask_open", { source: source || "launcher" });
    setTimeout(function () { input.focus(); }, 220);

    // Warm up the index in background
    ensureSearchReady();
  }

  /* ------------------------------------------------------------------ *
   * Launcher button
   * ------------------------------------------------------------------ */
  function mountLauncher() {
    if (window.location.pathname.indexOf("/ask") === 0) return; // skip on /ask/ itself
    if (document.querySelector(".askg-launch")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "askg-launch";
    btn.setAttribute("aria-label", "Ask GKB");
    btn.title = "Ask GKB";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .7-1 1.7v.5"/>' +
      '<circle cx="12" cy="17" r="0.5" fill="currentColor"/>' +
      '<path d="M21 12a9 9 0 1 1-3.3-6.95L21 4l-.7 3.3A8.95 8.95 0 0 1 21 12z"/>' +
      '</svg>';
    // Pulse on first page-load only (sessionStorage dismissal)
    try {
      if (!sessionStorage.getItem("askg_pulsed")) {
        btn.classList.add("askg-launch--pulse");
        sessionStorage.setItem("askg_pulsed", "1");
      }
    } catch (e) { /* sessionStorage may be blocked */ }

    btn.addEventListener("click", function () {
      btn.classList.remove("askg-launch--pulse");
      openModal("launcher");
    });

    document.body.appendChild(btn);
  }

  /* ------------------------------------------------------------------ *
   * Inline /ask/ page mount (called from page script)
   * ------------------------------------------------------------------ */
  window.AskGKB = {
    open: openModal,
    mountInline: function (rootSelector) {
      var root = document.querySelector(rootSelector);
      if (!root) return;
      state.inlineMode = true;
      var log = root.querySelector(".askg-log");
      var form = root.querySelector("[data-askg-form]");
      var input = root.querySelector(".askg-input");

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = input.value;
        input.value = "";
        handleSubmit(q, log, { source: "direct" });
      });

      // Suggestion chip wiring
      root.querySelectorAll("[data-askg-suggest]").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var q = chip.getAttribute("data-askg-suggest");
          input.value = q;
          form.dispatchEvent(new Event("submit", { cancelable: true }));
          track("ask_open", { source: "suggestion_chip" });
        });
      });

      // Pre-fill query if ?q= in URL
      try {
        var u = new URL(window.location.href);
        var preQ = u.searchParams.get("q");
        if (preQ) {
          input.value = preQ;
          form.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      } catch (e) { /* noop */ }

      track("ask_open", { source: "direct" });
      ensureSearchReady();
    },
  };

  /* ------------------------------------------------------------------ *
   * Auto-mount launcher on DOM ready
   * ------------------------------------------------------------------ */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountLauncher);
  } else {
    mountLauncher();
  }
})();
