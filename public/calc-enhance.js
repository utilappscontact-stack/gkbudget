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

  // Display config per calc slug. resultSel is the EXACT selector for that calc's
  // result panel — verified by tracing each calc's calculate function.
  // resultHeadline is the selector for the headline number/verdict to feature in PDF/AI prompt.
  var CALCS = {
    'construction':          {name:'Construction Cost Estimate',          short:'Construction',     methodSec:'construction',          resultSel:'#resultsPanel',  resultHeadline:'#totalCost',                    aiRole:'a structural engineer with deep knowledge of Indian residential construction in 2026'},
    'interior':              {name:'Interior Cost Estimate',              short:'Interior',         methodSec:'interior',              resultSel:'#intResults',    resultHeadline:'#intTotal',                     aiRole:'an Indian interior designer working in 2026'},
    'emi':                   {name:'Home Loan EMI Calculation',           short:'EMI',              methodSec:'emi',                   resultSel:'#resultsPanel',  resultHeadline:'#emiAmount,#emiTotal,#monthlyEMI', aiRole:'an Indian banking advisor familiar with home loans in 2026'},
    'emi-vs-rent':           {name:'EMI vs Rent Break-even Analysis',     short:'EMI vs Rent',      methodSec:'emi-vs-rent',           resultSel:'#resultPanel',   resultHeadline:'#verdictH,#rBuyWealth',         aiRole:'an Indian financial advisor specialising in home buying decisions in 2026'},
    'quote-check':           {name:'Contractor Quote Check',              short:'Quote Check',      methodSec:'quote-check',           resultSel:'#verdictPanel',  resultHeadline:'#verdictTitle',                 aiRole:'a construction project manager working in India in 2026'},
    'stamp-duty':            {name:'Stamp Duty & Registration Estimate',  short:'Stamp Duty',       methodSec:'stamp-duty',            resultSel:'#resultPanel',   resultHeadline:'.tot,#totDuty',                 aiRole:'a property lawyer practising in India in 2026'},
    'home-loan-eligibility': {name:'Home Loan Eligibility Estimate',      short:'Loan Eligibility', methodSec:'home-loan-eligibility', resultSel:'#resultPanel',   resultHeadline:'.tot,#maxLoan',                 aiRole:'an Indian banking advisor specialising in home loan eligibility'},
    'painting-cost':         {name:'Painting Cost Estimate',              short:'Painting',         methodSec:'painting-cost',         resultSel:'#resultPanel',   resultHeadline:'.tot',                          aiRole:'an Indian painting contractor with 10+ years experience'},
    'plot-viability':        {name:'Plot Purchase Viability Report',      short:'Plot Viability',   methodSec:'plot-viability',        resultSel:'#resultPanel',   resultHeadline:'#verdictH,.tot',                aiRole:'a real estate analyst with experience in Indian land markets in 2026'},
    'modular-kitchen':       {name:'Modular Kitchen Cost Estimate',       short:'Modular Kitchen',  methodSec:'modular-kitchen',       resultSel:'#resultPanel',   resultHeadline:'.tot,#totRange',                aiRole:'an Indian modular kitchen designer'},
    'bathroom-renovation':   {name:'Bathroom Renovation Cost Estimate',   short:'Bathroom',         methodSec:'bathroom-renovation',   resultSel:'.result',        resultHeadline:'#totCost,.totC',                aiRole:'an Indian residential plumber and bathroom contractor in 2026'},
    'waterproofing':         {name:'Waterproofing Cost Estimate',         short:'Waterproofing',    methodSec:'waterproofing',         resultSel:'.result',        resultHeadline:'#totCost,.totC',                aiRole:'an Indian waterproofing applicator with experience in monsoon zones'}
  };

  // Per-calc AI prompt templates.
  // {INPUTS} and {RESULT} are filled from the user's actual calculation.
  // {ROLE} comes from CALCS[slug].aiRole.
  var AI_PROMPTS = {
    'construction':
      "I used Ghar Ka Budget's Construction Cost calculator for an Indian residential build.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nESTIMATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is this estimate reasonable for the inputs above? Answer Yes / No / Possibly with reservations.\n"
      + "2. What 2-3 factors could push this estimate UP by 20%+ that I should specifically ask my contractor about? (e.g. soil bearing capacity, foundation depth, seismic zone)\n"
      + "3. What 2-3 factors could realistically reduce the cost by 10-15% without compromising structural quality?\n"
      + "4. List 3 red flags I should watch for in contractor quotes for this project.\n\n"
      + "Be specific to Indian context (CPWD norms, monsoon, seismic zones, local materials). Cite Indian sources where relevant. Be concise.",

    'interior':
      "I used Ghar Ka Budget's Interior Cost estimator for an Indian home.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nESTIMATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is this estimate realistic for the BHK type, finish tier, and city specified?\n"
      + "2. What 3 line items in interior fit-out are most commonly under-budgeted in initial quotes?\n"
      + "3. What is the typical premium that branded studios (Livspace, HomeLane, Sleek, Pepperfry) charge over a local-carpenter setup with the same materials?\n"
      + "4. What 'lifetime warranty' claims by interior firms actually cover, and what they don't.\n\n"
      + "Be Indian-context specific. Concise.",

    'emi':
      "I used Ghar Ka Budget's Home Loan EMI calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nCALCULATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Given current Indian home loan rates (May 2026), is this rate reasonable for the loan size and tenure shown?\n"
      + "2. What 3 prepayment or tenure-shortening strategies make the most financial sense for this loan?\n"
      + "3. Am I likely eligible for any PMAY interest subsidy or section 80EE/24 deductions based on these inputs?\n"
      + "4. What rate negotiation leverage do I realistically have with the lender, given my profile?\n\n"
      + "Be specific to Indian banking practices in 2026. Concise.",

    'emi-vs-rent':
      "I used Ghar Ka Budget's EMI vs Rent break-even calculator to decide whether to buy a house with a home loan or keep renting and invest the difference.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nCALCULATED VERDICT AND BREAK-EVEN:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Are my appreciation rate and alternative investment return assumptions realistic for this Indian city and 2026 conditions? If they look off, what's a more realistic range?\n"
      + "2. The calculator does not include home loan tax benefits (Section 24 interest, Section 80C principal, Section 80EE/EEA where applicable). How much do these typically tilt the verdict toward buying for someone in my income bracket?\n"
      + "3. What 3 non-financial factors (lifestyle stability, neighbourhood quality, family circumstances, job mobility) should weigh on this decision but are not in the model?\n"
      + "4. Given the verdict and my inputs, what 2-3 questions should I sit with for a week before committing either way?\n\n"
      + "Be specific to Indian residential real estate and personal finance practice in 2026. Concise.",

    'quote-check':
      "I used Ghar Ka Budget's contractor quote checker.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nVERDICT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Given this verdict, what should be my immediate next step with the contractor?\n"
      + "2. What 5 line items in an Indian contractor's BOQ are most commonly inflated?\n"
      + "3. What documents (BOQ, material specs, schedule, warranty) should I demand before paying any advance?\n"
      + "4. What is a reasonable advance-to-progress payment ratio for this project size?\n\n"
      + "Be specific to Indian residential construction practice. Concise.",

    'stamp-duty':
      "I used Ghar Ka Budget's Stamp Duty & Registration calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nCALCULATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Are these numbers correct for the state and buyer-gender combination as of 2026?\n"
      + "2. What 2 stamp duty exemptions, refunds, or rebates are commonly missed by buyers in this state?\n"
      + "3. Could the difference between agreement value and government circle rate change my actual liability? How do I verify the circle rate?\n"
      + "4. What documents must the seller provide before I make the stamp duty payment?\n\n"
      + "Be specific to the state mentioned. Concise.",

    'home-loan-eligibility':
      "I used Ghar Ka Budget's Home Loan Eligibility calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nCALCULATED ELIGIBILITY:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is this FOIR-based estimate realistic? What additional bank-specific filters (CIBIL band, employer category, property risk grade) could reduce it?\n"
      + "2. Which 2-3 lenders (SBI / HDFC / ICICI / Axis / Bajaj Housing / others) are most likely to approve this loan size for a profile like mine?\n"
      + "3. How should I structure a co-applicant addition to maximise eligibility?\n"
      + "4. What single change (CIBIL score, EMI reduction, salary documentation) would meaningfully increase my eligibility?\n\n"
      + "Be specific to Indian banking practice in 2026. Concise.",

    'painting-cost':
      "I used Ghar Ka Budget's Painting Cost calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nESTIMATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is this cost reasonable for the paint tier and area shown?\n"
      + "2. What 3 questions should I ask the painting contractor before signing?\n"
      + "3. How do I verify the contractor will actually use the paint brand and product he quoted (vs a cheaper substitute)?\n"
      + "4. What is a fair labour-vs-material cost split for this size of job in 2026?\n\n"
      + "Be Indian-context specific. Concise.",

    'plot-viability':
      "I used Ghar Ka Budget's Plot Purchase Viability calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nVERDICT AND NUMBERS:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is the assumed annual appreciation rate realistic for the state's peripheral corridors over the holding period?\n"
      + "2. What 3 location-quality signals (infrastructure, employment, registered transaction trend) should I check before committing?\n"
      + "3. What title / approval / encumbrance checks are non-negotiable for plot purchase in this state?\n"
      + "4. What is the typical liquidation discount if I need to sell within 12 months (vs holding to plan)?\n\n"
      + "Be specific to Indian land market dynamics in 2026. Concise.",

    'modular-kitchen':
      "I used Ghar Ka Budget's Modular Kitchen Cost calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nESTIMATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is this estimate reasonable for the layout, shutter finish, and length specified?\n"
      + "2. What 3 items do most modular kitchen quotes hide or under-spec? (e.g. carcass material grade, hardware brand, edge banding)\n"
      + "3. What is the warranty difference between a skilled local-carpenter modular vs a branded studio (Sleek / Hettich Studio / Hafele Aspekt)?\n"
      + "4. What 3 specific questions should I ask the carpenter about hardware (hinges, drawer slides, channels)?\n\n"
      + "Be Indian-context specific. Concise.",

    'bathroom-renovation':
      "I used Ghar Ka Budget's Bathroom Renovation Cost calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nESTIMATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is this estimate reasonable for the tile tier, sanitary tier, and area?\n"
      + "2. What 3 plumbing or waterproofing details are most commonly cut to lower the contractor's quote?\n"
      + "3. How do I verify the contractor will actually install the sanitary brand quoted (and not a cheaper visually-similar substitute)?\n"
      + "4. What inspection should I do on Day 3 of the renovation that catches 80% of future seepage problems?\n\n"
      + "Be Indian-context specific. Concise.",

    'waterproofing':
      "I used Ghar Ka Budget's Waterproofing Cost calculator.\n\n"
      + "MY INPUTS:\n{INPUTS}\n\nESTIMATED RESULT:\n{RESULT}\n\n"
      + "Acting as {ROLE}, please:\n"
      + "1. Is the waterproofing method I selected appropriate for this surface type and condition?\n"
      + "2. What 3 surface preparation steps do contractors most commonly skip to reduce their quote?\n"
      + "3. What 2-3 visible signs at Day-1 of application tell me the workmanship will be high vs low quality?\n"
      + "4. What specific clauses should I demand in the warranty document for this method?\n\n"
      + "Be Indian-context specific. Concise."
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
    // Build radio map: name -> { value -> element }
    var radioMap = {};
    var radios = document.querySelectorAll('input[type=radio]');
    for(var i=0;i<radios.length;i++){
      var rr = radios[i];
      if(!rr.name) continue;
      if(!radioMap[rr.name]) radioMap[rr.name] = {};
      radioMap[rr.name][rr.value] = rr;
    }

    params.forEach(function(value, key){
      try {
        if(value === undefined || value === null) return;

        var el = document.getElementById(key);
        if(el){
          if((el.tagName==='INPUT' && el.type!=='radio' && el.type!=='checkbox') || el.tagName==='SELECT' || el.tagName==='TEXTAREA'){
            el.value = value;
            try { el.dispatchEvent(new Event('change', {bubbles:true})); } catch(e){}
            try { el.dispatchEvent(new Event('input',  {bubbles:true})); } catch(e){}
            applied = true;
            return;
          }
          if(el.tagName==='INPUT' && el.type==='checkbox'){
            el.checked = (value==='1' || value==='true' || value==='on');
            try { el.dispatchEvent(new Event('change', {bubbles:true})); } catch(e){}
            applied = true;
            return;
          }
        }

        // Try radio group: lookup is map-based, no CSS.escape needed
        if(radioMap[key] && radioMap[key][value]){
          var radio = radioMap[key][value];
          radio.checked = true;
          try { radio.dispatchEvent(new Event('change', {bubbles:true})); } catch(e){}
          applied = true;
        }
      } catch(e){
        // never let a single param failure stop the rest
        if(window.console && console.warn) console.warn('gkb param skip:', key, e.message);
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
    // Primary: explicit per-calc selector from the registry
    if(INFO.resultSel){
      var el = document.querySelector(INFO.resultSel);
      if(el) return el;
    }
    // Defensive fallback chain — covers minor structural drift
    var sels = ['#resultPanel.show', '#resultsPanel.show', '#intResults', '#verdictPanel',
                '#resultPanel', '#resultsPanel', '.result.show', '.results-panel',
                '.verdict-panel', '.result'];
    for(var i=0;i<sels.length;i++){
      var e = document.querySelector(sels[i]);
      if(e) return e;
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
      + '<div class="gkb-actions-lead">'
      +   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
      +   '<span>Save or share this estimate</span>'
      + '</div>'
      + '<div class="gkb-actions-btns">'
      +   '<button type="button" class="gkb-act gkb-act-share" onclick="window.gkbShare()" aria-label="Copy a shareable link to your calculation">'
      +     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
      +     '<span>Copy link</span>'
      +   '</button>'
      +   '<button type="button" class="gkb-act gkb-act-image" onclick="window.gkbImage()" aria-label="Share this calculation as an image (for WhatsApp)">'
      +     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
      +     '<span>Share as image</span>'
      +   '</button>'
      +   '<button type="button" class="gkb-act gkb-act-pdf" onclick="window.gkbPDF()" aria-label="Download this calculation as a PDF report">'
      +     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>'
      +     '<span>Download PDF</span>'
      +   '</button>'
      +   '<button type="button" class="gkb-act gkb-act-ai" onclick="window.gkbAI()" aria-label="Get a verification prompt to cross-check this estimate with AI">'
      +     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
      +     '<span>Verify with AI</span>'
      +   '</button>'
      + '</div>'
      + '<div class="gkb-actions-foot">'
      +   '<a href="/methodology/#'+INFO.methodSec+'" target="_blank" rel="noopener">'
      +     'Methodology &amp; sources for this calculator &rarr;'
      +   '</a>'
      + '</div>';

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
  // ───────────────────────────────────────────────────────────
  // Shared: gather current calc state (inputs + result text)
  // Used by PDF, AI prompt, and image-share features.
  // ───────────────────────────────────────────────────────────
  function gatherCalcState(){
    var inputs = [];

    // text/number/date/select inputs
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function(el){
      if(!el.id) return;
      if(el.type==='hidden' || el.type==='radio' || el.type==='checkbox') return;
      var f = el.closest('.field');
      if(f && getComputedStyle(f).display === 'none') return;
      var v = el.value;
      if(v === '' || v == null) return;
      var renderV = v;
      if(el.tagName === 'SELECT' && el.selectedIndex >= 0){
        var opt = el.options[el.selectedIndex];
        if(opt && opt.textContent) renderV = opt.textContent.trim();
      }
      inputs.push({label: findLabel(el), value: renderV});
    });

    // checkboxes
    document.querySelectorAll('input[type=checkbox][id]').forEach(function(cb){
      if(!cb.checked) return;
      inputs.push({label: findLabel(cb), value: 'Yes'});
    });

    // radio groups (one row per group)
    var seenRadios = {};
    document.querySelectorAll('input[type=radio]:checked').forEach(function(r){
      if(seenRadios[r.name]) return;
      seenRadios[r.name] = true;
      var label = selectedRadioLabel(r.name) || r.value;
      var groupLabel = '';
      var fset = r.closest('.fset, .field');
      if(fset){
        var h = fset.querySelector('.fset-h, label');
        if(h) groupLabel = h.textContent.trim();
      }
      inputs.push({label: groupLabel || r.name, value: label});
    });

    // Headline result — try the configured selector(s); fallback to result panel text
    var headline = '';
    if(INFO.resultHeadline){
      var sels = INFO.resultHeadline.split(',');
      for(var i=0;i<sels.length;i++){
        var el = document.querySelector(sels[i].trim());
        if(el && el.textContent.trim()){
          headline = el.textContent.replace(/\s+/g,' ').trim();
          break;
        }
      }
    }

    // Full result text (cleaned) — for AI prompt context
    var resultText = '';
    var anchor = findResultAnchor();
    if(anchor){
      var clone = anchor.cloneNode(true);
      var actBar = clone.querySelector('#gkb-actions');
      if(actBar) actBar.remove();
      // strip script tags inside (defensive)
      clone.querySelectorAll('script,style').forEach(function(s){ s.remove(); });
      // collapse whitespace
      resultText = clone.textContent.replace(/\s+/g, ' ').trim();
      // hard cap — AI prompts get unwieldy if result is long
      if(resultText.length > 1200) resultText = resultText.substring(0, 1200) + '…';
    }

    return { inputs: inputs, headline: headline, resultText: resultText };
  }


  function buildPrintLayout(){
    var existing = document.getElementById('gkb-print');
    if(existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var state = gatherCalcState();
    var inputs = state.inputs;

    // Result block — clone visible result panel
    var anchor = findResultAnchor();
    var resultClone = null;
    if(anchor){
      resultClone = anchor.cloneNode(true);
      var actBar = resultClone.querySelector('#gkb-actions');
      if(actBar) actBar.remove();
    }

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
      +   '<div class="gp-foot-disclaimer">Numbers are estimates based on the latest published rates and the inputs above. Variance is typically &plusmn;15% for cost estimates. This is not financial or engineering advice. Verify all figures with vendors before commitment. &copy; 2026 Ghar Ka Budget.</div>'
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
  // 6) AI verification prompt
  // ───────────────────────────────────────────────────────────
  function buildAIPrompt(){
    var template = AI_PROMPTS[SLUG];
    if(!template) return '';
    var state = gatherCalcState();
    var inputsBlock = state.inputs.map(function(row){
      return '- ' + row.label.replace(/[\s:]+$/,'') + ': ' + row.value;
    }).join('\n');
    var resultBlock = state.headline ? state.headline + '\n\n' + state.resultText : state.resultText;
    return template
      .replace('{INPUTS}', inputsBlock || '(no inputs captured)')
      .replace('{RESULT}', resultBlock || '(no result yet)')
      .replace('{ROLE}', INFO.aiRole || 'a domain expert');
  }

  function openAIModal(){
    // remove existing modal if present
    var existing = document.getElementById('gkb-ai-modal');
    if(existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var prompt = buildAIPrompt();
    var encoded = encodeURIComponent(prompt);
    // ChatGPT and Claude both support ?q= for new chat with prompt pre-filled
    var chatgptURL = 'https://chat.openai.com/?q=' + encoded;
    var claudeURL  = 'https://claude.ai/new?q=' + encoded;
    var geminiURL  = 'https://gemini.google.com/app?q=' + encoded;

    var modal = document.createElement('div');
    modal.id = 'gkb-ai-modal';
    modal.className = 'gkb-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','AI verification prompt');
    modal.innerHTML = ''
      + '<div class="gkb-modal-backdrop" onclick="window.gkbCloseAIModal()"></div>'
      + '<div class="gkb-modal-card">'
      +   '<div class="gkb-modal-head">'
      +     '<div>'
      +       '<div class="gkb-modal-eyebrow">Verify with AI</div>'
      +       '<h3 class="gkb-modal-title">Cross-check this estimate with ChatGPT, Claude, or Gemini</h3>'
      +     '</div>'
      +     '<button type="button" class="gkb-modal-close" onclick="window.gkbCloseAIModal()" aria-label="Close">×</button>'
      +   '</div>'
      +   '<p class="gkb-modal-help">Below is a prompt curated for this calculator. It includes your inputs and result, and asks an AI assistant to act as the right kind of Indian expert and cross-check our number. Copy it, paste into your favourite AI tool, and see if the answers reinforce or challenge the estimate.</p>'
      +   '<textarea class="gkb-modal-prompt" id="gkb-ai-prompt-text" readonly></textarea>'
      +   '<div class="gkb-modal-btns">'
      +     '<button type="button" class="gkb-act gkb-act-share" onclick="window.gkbCopyAIPrompt()">'
      +       '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      +       '<span>Copy prompt</span>'
      +     '</button>'
      +     '<a class="gkb-act gkb-act-method" href="'+chatgptURL+'" target="_blank" rel="noopener">Open in ChatGPT &rarr;</a>'
      +     '<a class="gkb-act gkb-act-method" href="'+claudeURL+'" target="_blank" rel="noopener">Open in Claude &rarr;</a>'
      +     '<a class="gkb-act gkb-act-method" href="'+geminiURL+'" target="_blank" rel="noopener">Open in Gemini &rarr;</a>'
      +   '</div>'
      +   '<p class="gkb-modal-foot">Note: the AI is doing a sanity check, not replacing our calc. If its answer disagrees materially, send us a note via the <a href="/contact/" target="_blank" rel="noopener">contact form</a> &mdash; we&rsquo;ll investigate within 48 hours.</p>'
      + '</div>';

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    // Set the prompt text via property to avoid HTML-escaping issues
    var ta = document.getElementById('gkb-ai-prompt-text');
    if(ta) ta.value = prompt;

    if(typeof window.gtag === 'function'){
      try { window.gtag('event','calc_ai_open',{calculator:SLUG}); } catch(e){}
    }
  }

  window.gkbAI = openAIModal;

  window.gkbCloseAIModal = function(){
    var m = document.getElementById('gkb-ai-modal');
    if(m && m.parentNode) m.parentNode.removeChild(m);
    document.body.style.overflow = '';
  };

  window.gkbCopyAIPrompt = function(){
    var ta = document.getElementById('gkb-ai-prompt-text');
    if(!ta) return;
    var text = ta.value;
    function ok(){ toast('AI prompt copied — paste into ChatGPT, Claude, or Gemini', 'ok'); }
    function fallback(){
      try { ta.select(); document.execCommand('copy'); ok(); }
      catch(e){ window.prompt('Copy this prompt:', text); }
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else {
      fallback();
    }
    if(typeof window.gtag === 'function'){
      try { window.gtag('event','calc_ai_copy',{calculator:SLUG}); } catch(e){}
    }
  };

  // ───────────────────────────────────────────────────────────
  // 7) Image share (canvas-rendered branded card for WhatsApp)
  // ───────────────────────────────────────────────────────────
  function buildShareImage(){
    var W = 1080, H = 1350; // Instagram/WhatsApp portrait
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    var state = gatherCalcState();

    // Background gradient
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(1, '#F5F5F3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    ctx.fillStyle = '#E87722';
    ctx.fillRect(0, 0, W, 12);

    // Brand row
    ctx.fillStyle = '#E87722';
    ctx.fillRect(80, 80, 64, 64);
    // logo lines
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(96, 102, 32, 4);
    ctx.fillRect(96, 116, 24, 4);
    ctx.fillRect(96, 130, 32, 4);

    // Brand name
    ctx.fillStyle = '#2D3A4A';
    ctx.font = 'bold 36px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Ghar Ka Budget', 168, 90);
    ctx.fillStyle = '#E87722';
    ctx.font = '20px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('gharkabudget.com', 168, 130);

    // Calc title
    ctx.fillStyle = '#2D3A4A';
    ctx.font = '600 28px "Inter", "Helvetica Neue", Arial, sans-serif';
    wrapText(ctx, INFO.name, 80, 220, W - 160, 38);

    // Headline result — big number
    ctx.fillStyle = '#1C1C1A';
    ctx.font = 'bold 80px "Inter", "Helvetica Neue", Arial, sans-serif';
    var headline = state.headline || '—';
    // Truncate if too long
    if(headline.length > 28) headline = headline.substring(0, 28) + '…';
    var headlineY = 320;
    wrapText(ctx, headline, 80, headlineY, W - 160, 96);

    // Divider
    ctx.strokeStyle = '#E0DDE0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 500);
    ctx.lineTo(W - 80, 500);
    ctx.stroke();

    // Inputs label
    ctx.fillStyle = '#E87722';
    ctx.font = 'bold 18px "Inter", sans-serif';
    ctx.fillText('YOUR INPUTS', 80, 530);

    // Inputs list — show top 6
    ctx.font = '24px "Inter", sans-serif';
    var topInputs = state.inputs.slice(0, 6);
    var y = 580;
    topInputs.forEach(function(row){
      var label = (row.label || '').replace(/[\s:]+$/, '');
      if(label.length > 32) label = label.substring(0, 32) + '…';
      var value = String(row.value || '');
      if(value.length > 28) value = value.substring(0, 28) + '…';

      ctx.fillStyle = '#666';
      ctx.fillText(label, 80, y);

      ctx.fillStyle = '#2D3A4A';
      ctx.font = '600 24px "Inter", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value, W - 80, y);
      ctx.textAlign = 'left';
      ctx.font = '24px "Inter", sans-serif';

      y += 56;
    });
    if(state.inputs.length > 6){
      ctx.fillStyle = '#888';
      ctx.font = 'italic 20px "Inter", sans-serif';
      ctx.fillText('+ ' + (state.inputs.length - 6) + ' more inputs in full result', 80, y);
    }

    // Footer band
    ctx.fillStyle = '#2D3A4A';
    ctx.fillRect(0, H - 220, W, 220);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "Inter", sans-serif';
    ctx.fillText('Run this calc yourself:', 80, H - 180);

    ctx.fillStyle = '#E87722';
    ctx.font = '600 30px "Inter", sans-serif';
    ctx.fillText('gharkabudget.com/' + SLUG + '/', 80, H - 140);

    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '18px "Inter", sans-serif';
    ctx.fillText('Free · No signup · Updated quarterly · Sourced & cited', 80, H - 90);
    ctx.fillText('Methodology: gharkabudget.com/methodology/', 80, H - 60);

    return canvas;
  }

  function wrapText(ctx, text, x, y, maxW, lineH){
    var words = String(text).split(/\s+/);
    var line = '', lines = [];
    for(var i=0;i<words.length;i++){
      var test = line ? line + ' ' + words[i] : words[i];
      if(ctx.measureText(test).width > maxW && line){
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if(line) lines.push(line);
    for(var j=0;j<lines.length;j++){
      ctx.fillText(lines[j], x, y + j*lineH);
    }
  }

  window.gkbImage = function(){
    var canvas;
    try { canvas = buildShareImage(); }
    catch(e){
      toast('Could not generate image. Try the link share instead.', 'err');
      console.warn('gkb image build failed:', e);
      return;
    }

    canvas.toBlob(function(blob){
      if(!blob){
        toast('Could not save image.', 'err');
        return;
      }
      var filename = 'gharkabudget-' + SLUG + '-' + Date.now() + '.png';

      // Try Web Share API with files (mobile WhatsApp/Instagram share sheet)
      if(navigator.canShare && navigator.share){
        var file = new File([blob], filename, {type:'image/png'});
        try {
          if(navigator.canShare({ files: [file] })){
            navigator.share({
              files: [file],
              title: INFO.name,
              text: 'My ' + INFO.short + ' estimate from gharkabudget.com'
            }).then(function(){
              if(typeof window.gtag === 'function'){
                try { window.gtag('event','calc_image_share',{calculator:SLUG, method:'web_share'}); } catch(e){}
              }
            }).catch(function(){
              // user cancelled or share unavailable; fall through to download
              downloadBlob(blob, filename);
            });
            return;
          }
        } catch(e){}
      }
      // Desktop fallback: trigger download
      downloadBlob(blob, filename);
      toast('Image saved — attach it in WhatsApp', 'ok');
      if(typeof window.gtag === 'function'){
        try { window.gtag('event','calc_image_share',{calculator:SLUG, method:'download'}); } catch(e){}
      }
    }, 'image/png', 0.92);
  };

  function downloadBlob(blob, filename){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      URL.revokeObjectURL(url);
      if(a.parentNode) a.parentNode.removeChild(a);
    }, 1000);
  }

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
    try { hookGtag(); } catch(e){ if(window.console) console.warn('gkb hookGtag failed:', e); }
    try {
      APPLIED_FROM_URL = applyURLParams();
      if(APPLIED_FROM_URL){
        // wait a bit for any late-binding listeners (radio change handlers etc.)
        setTimeout(function(){ try { autoRunCalc(); } catch(e){} }, 350);
      }
    } catch(e){ if(window.console) console.warn('gkb init failed:', e); }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
