/* Ghar Ka Budget — calc-enhance.js
 * Adds three things to every calculator page, additively, without touching calc logic:
 *   1) URL state encoding/decoding (shareable links)
 *   2) "Copy share link" button
 *   3) "Download PDF" button (uses browser print-to-PDF + dedicated print stylesheet)
 *
 * Hooks into the existing gtag('event','calc_completed',...) call that all 11 calcs already fire,
 * so no per-calc modification of calculate functions is required.
 */
(function(){
  'use strict';

  // Display config per calc slug
  var CALCS = {
    'construction':          {name:'Construction Cost Estimate',          short:'Construction',     methodSec:'construction'},
    'interior':              {name:'Interior Cost Estimate',              short:'Interior',         methodSec:'interior'},
    'emi':                   {name:'Home Loan EMI Calculation',           short:'EMI',              methodSec:'emi'},
    'quote-check':           {name:'Contractor Quote Check',              short:'Quote Check',      methodSec:'quote-check'},
    'stamp-duty':            {name:'Stamp Duty & Registration Estimate',  short:'Stamp Duty',       methodSec:'stamp-duty'},
    'home-loan-eligibility': {name:'Home Loan Eligibility Estimate',      short:'Loan Eligibility', methodSec:'home-loan-eligibility'},
    'painting-cost':         {name:'Painting Cost Estimate',              short:'Painting',         methodSec:'painting-cost'},
    'plot-viability':        {name:'Plot Purchase Viability Report',      short:'Plot Viability',   methodSec:'plot-viability'},
    'modular-kitchen':       {name:'Modular Kitchen Cost Estimate',       short:'Modular Kitchen',  methodSec:'modular-kitchen'},
    'bathroom-renovation':   {name:'Bathroom Renovation Cost Estimate',   short:'Bathroom',         methodSec:'bathroom-renovation'},
    'waterproofing':         {name:'Waterproofing Cost Estimate',         short:'Waterproofing',    methodSec:'waterproofing'}
  };

  function getSlug(){
    var path = window.location.pathname.replace(/\/+$/, '');
    var seg = path.split('/').pop();
    return CALCS[seg] ? seg : null;
  }

  var SLUG = getSlug();
  if(!SLUG) return; // not a recognised calc page
  var INFO = CALCS[SLUG];
  var APPLIED_FROM_URL = false; // set true if we populated inputs from URL

  // ───────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────
  function toast(msg, kind){
    var t = document.createElement('div');
    t.className = 'gkb-toast' + (kind ? ' gkb-toast--'+kind : '');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('gkb-toast--show'); });
    setTimeout(function(){
      t.classList.remove('gkb-toast--show');
      setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 280);
    }, 2400);
  }

  function findLabel(el){
    // 1) explicit <label for="id">
    if(el.id){
      var lab = document.querySelector('label[for="'+el.id+'"]');
      if(lab && lab.textContent.trim()) return lab.textContent.trim();
    }
    // 2) parent .field has a label inside
    var p = el.parentElement;
    while(p && p !== document.body){
      var l = p.querySelector(':scope > label');
      if(l && l.textContent.trim()) return l.textContent.trim();
      // also try first label inside this ancestor
      l = p.querySelector('label');
      if(l && l.textContent.trim() && p.classList.contains('field')) return l.textContent.trim();
      p = p.parentElement;
      if(p && (p.classList.contains('fset') || p.classList.contains('calc-card'))) break;
    }
    return el.id || el.name || '';
  }

  function selectedRadioLabel(name){
    var checked = document.querySelector('input[type=radio][name="'+name+'"]:checked');
    if(!checked) return null;
    // look for an enclosing label
    var lbl = checked.closest('label');
    if(lbl){
      // get label text minus any nested input text
      var clone = lbl.cloneNode(true);
      var inputs = clone.querySelectorAll('input');
      inputs.forEach(function(i){ i.remove(); });
      var t = clone.textContent.replace(/\s+/g,' ').trim();
      if(t) return t;
    }
    return checked.value;
  }

  function fmtINR(){return null;} // not used here; calcs format their own

  // ───────────────────────────────────────────────────────────
  // 1) URL params → form fields  (on page load)
  // ───────────────────────────────────────────────────────────
  function applyURLParams(){
    var params = new URLSearchParams(window.location.search);
    if(params.toString() === '') return false;

    var applied = false;
    params.forEach(function(value, key){
      if(!value && value !== '0') return;

      var el = document.getElementById(key);
      if(el){
        if((el.tagName==='INPUT' && el.type!=='radio' && el.type!=='checkbox') || el.tagName==='SELECT' || el.tagName==='TEXTAREA'){
          el.value = value;
          el.dispatchEvent(new Event('change', {bubbles:true}));
          el.dispatchEvent(new Event('input',  {bubbles:true}));
          applied = true;
          return;
        }
        if(el.tagName==='INPUT' && el.type==='checkbox'){
          el.checked = (value==='1' || value==='true' || value==='on');
          el.dispatchEvent(new Event('change', {bubbles:true}));
          applied = true;
          return;
        }
      }

      // try radio: name=key, value=value
      var radio = document.querySelector('input[type=radio][name="'+CSS.escape(key)+'"][value="'+CSS.escape(value)+'"]');
      if(radio){
        radio.checked = true;
        radio.dispatchEvent(new Event('change', {bubbles:true}));
        applied = true;
      }
    });
    return applied;
  }

  function autoRunCalc(){
    // find primary calc button (not a preset, not the hamburger)
    var candidates = document.querySelectorAll('button[onclick]');
    for(var i=0;i<candidates.length;i++){
      var b = candidates[i];
      var oc = b.getAttribute('onclick') || '';
      // must call something starting with "calc" or "calculate" or "checkQuote", and not a preset/menu
      if(/^(?:calc|calculate|checkQuote)/i.test(oc.trim().replace(/^\s*/, ''))){
        if(b.classList.contains('preset-btn')) continue;
        if(b.classList.contains('hbg')) continue;
        if(/preset|loadPreset|toggle|menu/i.test(oc)) continue;
        try { b.click(); return true; } catch(e){ return false; }
      }
    }
    return false;
  }

  // ───────────────────────────────────────────────────────────
  // 2) Build URL from current form state
  // ───────────────────────────────────────────────────────────
  function buildShareURL(){
    var url = new URL(window.location.href);
    url.search = '';

    // input/select/textarea with id (excluding radio and checkbox)
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function(el){
      if(!el.id) return;
      if(el.type === 'hidden') return;
      if(el.type === 'radio') return;
      if(el.type === 'checkbox') return;
      // skip elements inside a hidden field (display:none parent.field)
      var f = el.closest('.field');
      if(f && getComputedStyle(f).display === 'none') return;
      var v = el.value;
      if(v !== '' && v != null){
        url.searchParams.set(el.id, v);
      }
    });

    // checkboxes (id-based) → only if checked
    document.querySelectorAll('input[type=checkbox][id]').forEach(function(cb){
      if(cb.checked) url.searchParams.set(cb.id, '1');
    });

    // radio groups → use group name + checked value
    var radioNames = {};
    document.querySelectorAll('input[type=radio]:checked').forEach(function(r){
      if(r.name) radioNames[r.name] = r.value;
    });
    Object.keys(radioNames).forEach(function(n){
      url.searchParams.set(n, radioNames[n]);
    });

    return url.toString();
  }

  // ───────────────────────────────────────────────────────────
  // 3) Action buttons (Share / PDF / Methodology)
  // ───────────────────────────────────────────────────────────
  function findResultAnchor(){
    // Priority: visible result panel > generic .result.show > .results-panel > .result
    var sels = ['#resultPanel.show', '#resultsPanel.show', '#resultPanel', '#resultsPanel', '.result.show', '.results-panel', '.result'];
    for(var i=0;i<sels.length;i++){
      var el = document.querySelector(sels[i]);
      if(el) return el;
    }
    return null;
  }

  function injectActionBar(){
    if(document.getElementById('gkb-actions')) return;
    var anchor = findResultAnchor();
    if(!anchor) return;

    var bar = document.createElement('div');
    bar.id = 'gkb-actions';
    bar.className = 'gkb-actions';
    bar.innerHTML = ''
      + '<button type="button" class="gkb-act gkb-act-share" onclick="window.gkbShare()" aria-label="Copy shareable link to your calculation">'
      +   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
      +   '<span>Copy share link</span>'
      + '</button>'
      + '<button type="button" class="gkb-act gkb-act-pdf" onclick="window.gkbPDF()" aria-label="Download this calculation as a PDF report">'
      +   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>'
      +   '<span>Download PDF</span>'
      + '</button>'
      + '<a href="/methodology/#'+INFO.methodSec+'" class="gkb-act gkb-act-method" target="_blank" rel="noopener" aria-label="Open the methodology and sources page in a new tab">'
      +   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
      +   '<span>Methodology &amp; sources</span>'
      + '</a>';

    anchor.insertBefore(bar, anchor.firstChild);
  }

  // ───────────────────────────────────────────────────────────
  // 4) Share button
  // ───────────────────────────────────────────────────────────
  window.gkbShare = function(){
    var url = buildShareURL();
    try { window.history.replaceState({}, '', url); } catch(e){}

    function ok(){ toast('Link copied — share on WhatsApp', 'ok'); }
    function fallback(){ window.prompt('Copy this share link:', url); }

    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(ok, function(){
        // some browsers refuse async clipboard outside of user activation; retry sync
        try {
          var ta = document.createElement('textarea');
          ta.value = url; ta.style.position='fixed'; ta.style.opacity='0';
          document.body.appendChild(ta); ta.select();
          var ok2 = document.execCommand('copy');
          document.body.removeChild(ta);
          if(ok2) ok(); else fallback();
        } catch(e2){ fallback(); }
      });
    } else {
      fallback();
    }

    if(typeof window.gtag === 'function'){
      try { window.gtag('event','calc_share',{calculator:SLUG, share_method:'copy_link'}); } catch(e){}
    }
  };

  // ───────────────────────────────────────────────────────────
  // 5) PDF button (browser print-to-PDF)
  // ───────────────────────────────────────────────────────────
  function buildPrintLayout(){
    var existing = document.getElementById('gkb-print');
    if(existing && existing.parentNode) existing.parentNode.removeChild(existing);

    // Inputs section
    var inputs = [];
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function(el){
      if(!el.id) return;
      if(el.type==='hidden' || el.type==='radio' || el.type==='checkbox') return;
      var f = el.closest('.field');
      if(f && getComputedStyle(f).display === 'none') return;
      var v = el.value;
      if(v === '' || v == null) return;
      // Try to render select option text instead of value
      var renderV = v;
      if(el.tagName === 'SELECT' && el.selectedIndex >= 0){
        var opt = el.options[el.selectedIndex];
        if(opt && opt.textContent) renderV = opt.textContent.trim();
      }
      var label = findLabel(el);
      inputs.push({label: label, value: renderV});
    });
    document.querySelectorAll('input[type=checkbox][id]').forEach(function(cb){
      if(!cb.checked) return;
      var label = findLabel(cb);
      inputs.push({label: label, value: 'Yes'});
    });
    var seenRadios = {};
    document.querySelectorAll('input[type=radio]:checked').forEach(function(r){
      if(seenRadios[r.name]) return;
      seenRadios[r.name] = true;
      var label = selectedRadioLabel(r.name) || r.value;
      // try to also identify the group label
      var groupLabel = '';
      var fset = r.closest('.fset, .field');
      if(fset){
        var h = fset.querySelector('.fset-h, label');
        if(h) groupLabel = h.textContent.trim();
      }
      inputs.push({label: groupLabel || r.name, value: label});
    });

    // Result block — clone visible result panel
    var anchor = findResultAnchor();
    var resultClone = null;
    if(anchor){
      resultClone = anchor.cloneNode(true);
      // strip the action bar from the clone
      var actBar = resultClone.querySelector('#gkb-actions');
      if(actBar) actBar.remove();
    }

    // Build print container
    var div = document.createElement('div');
    div.id = 'gkb-print';

    var dt = new Date();
    var dStr = dt.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]+' '+dt.getFullYear();
    var tStr = ('0'+dt.getHours()).slice(-2)+':'+('0'+dt.getMinutes()).slice(-2);

    var inputsHTML = '';
    if(inputs.length){
      inputsHTML = '<table class="gp-tbl"><thead><tr><th>Field</th><th>Your input</th></tr></thead><tbody>';
      inputs.forEach(function(row){
        inputsHTML += '<tr><td>'+escapeHtml(row.label)+'</td><td>'+escapeHtml(row.value)+'</td></tr>';
      });
      inputsHTML += '</tbody></table>';
    }

    var shareURL = buildShareURL();

    div.innerHTML = ''
      + '<header class="gp-head">'
      +   '<div class="gp-brand-row">'
      +     '<div class="gp-brand">'
      +       '<span class="gp-logo"><span></span></span>'
      +       '<span class="gp-brand-name">Ghar Ka Budget</span>'
      +     '</div>'
      +     '<div class="gp-meta">'
      +       '<div class="gp-date">'+dStr+' &middot; '+tStr+'</div>'
      +       '<div class="gp-url">gharkabudget.com</div>'
      +     '</div>'
      +   '</div>'
      +   '<h1 class="gp-title">'+escapeHtml(INFO.name)+'</h1>'
      + '</header>'
      + '<section class="gp-section">'
      +   '<h2 class="gp-h2">Your inputs</h2>'
      +   inputsHTML
      + '</section>'
      + '<section class="gp-section gp-results">'
      +   '<h2 class="gp-h2">Result</h2>'
      +   '<div class="gp-result-host"></div>'
      + '</section>'
      + '<footer class="gp-foot">'
      +   '<div class="gp-foot-row"><strong>Methodology &amp; sources:</strong> gharkabudget.com/methodology/#'+INFO.methodSec+'</div>'
      +   '<div class="gp-foot-row"><strong>Share this calculation:</strong> <span class="gp-share-url">'+escapeHtml(shareURL)+'</span></div>'
      +   '<div class="gp-foot-disclaimer">Numbers are estimates based on Q2 2026 rates and the inputs above. Variance is typically &plusmn;15% for cost estimates. This is not financial or engineering advice. Verify all figures with vendors before commitment. &copy; 2026 Ghar Ka Budget.</div>'
      + '</footer>';

    if(resultClone){
      div.querySelector('.gp-result-host').appendChild(resultClone);
    }

    document.body.appendChild(div);
    return div;
  }

  function escapeHtml(s){
    if(s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  window.gkbPDF = function(){
    buildPrintLayout();
    document.body.classList.add('gkb-printing');

    // Some browsers need a frame to apply the @media print stylesheet
    setTimeout(function(){
      try { window.print(); } catch(e){ console.warn('print failed', e); }
      // Clean up after the print dialog closes (the after-print event is the proper signal,
      // but on some Android webviews it never fires; also add a defensive timeout)
      var cleaned = false;
      function cleanup(){
        if(cleaned) return; cleaned = true;
        document.body.classList.remove('gkb-printing');
        var p = document.getElementById('gkb-print');
        if(p && p.parentNode) p.parentNode.removeChild(p);
        window.removeEventListener('afterprint', cleanup);
      }
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 8000); // fallback
    }, 80);

    if(typeof window.gtag === 'function'){
      try { window.gtag('event','calc_pdf',{calculator:SLUG}); } catch(e){}
    }
  };

  // ───────────────────────────────────────────────────────────
  // 6) Hook into gtag('event','calc_completed',...)
  // ───────────────────────────────────────────────────────────
  function hookGtag(){
    var orig = window.gtag;
    if(typeof orig !== 'function') return;
    window.gtag = function(action, eventName){
      try {
        if(action === 'event' && eventName === 'calc_completed'){
          // result panel just rendered — wait one frame for DOM to settle, then act
          setTimeout(function(){
            injectActionBar();
            try {
              var url = buildShareURL();
              window.history.replaceState({}, '', url);
            } catch(e){}
          }, 60);
        }
      } catch(e){}
      return orig.apply(this, arguments);
    };
  }

  // ───────────────────────────────────────────────────────────
  // Init
  // ───────────────────────────────────────────────────────────
  function init(){
    hookGtag();
    APPLIED_FROM_URL = applyURLParams();
    if(APPLIED_FROM_URL){
      // wait a bit for any late-binding listeners (radio change handlers etc.)
      setTimeout(autoRunCalc, 350);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
