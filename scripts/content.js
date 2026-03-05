(() => {
  'use strict';

  const CARD_ID = 'autoscout-card';

  // Avoid duplicate injection on the same page
  if (document.getElementById(CARD_ID)) return;

  // ── JD extraction ──────────────────────────────────────────────────────────

  function extractSeekJD() {
    // Seek job detail page selectors (may change with site updates)
    const selectors = [
      '[data-automation="jobAdDetails"]',
      '.jobAdDetails',
      '[class*="jobDescription"]',
      'article[class*="job"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 100) return el.innerText.trim();
    }
    return null;
  }

  function extractLinkedInJD() {
    const selectors = [
      '.jobs-description__content',
      '.jobs-box__html-content',
      '[class*="job-description"]',
      '.description__text',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 100) return el.innerText.trim();
    }
    return null;
  }

  function cleanText(raw) {
    return raw
      .replace(/[ \t]+/g, ' ')        // collapse inline whitespace
      .replace(/\n{3,}/g, '\n\n')      // collapse excessive blank lines
      .trim()
      .slice(0, 2000);                 // hard cap at 2000 chars (~500 tokens)
  }

  function extractJD() {
    const host = window.location.hostname;
    let text = null;

    if (host.includes('seek.com.au')) text = extractSeekJD();
    else if (host.includes('linkedin.com')) text = extractLinkedInJD();

    // Fallback: grab the longest <article> or <main>
    if (!text) {
      const candidates = [...document.querySelectorAll('article, main, [role="main"]')];
      for (const el of candidates) {
        const t = el.innerText.trim();
        if (t.length > (text?.length ?? 0)) text = t;
      }
    }

    if (!text || text.length < 100) {
      text = document.body.innerText.trim();
    }

    return cleanText(text);
  }

  // ── Card construction ──────────────────────────────────────────────────────

  function buildCard(title) {
    const card = document.createElement('div');
    card.id = CARD_ID;
    const titleHtml = title
      ? `<div class="as-job-title">${title.length > 55 ? title.slice(0, 52) + '…' : title}</div>`
      : '';
    card.innerHTML = `
      <div class="as-status-bar"></div>
      <div class="as-header">
        <div class="as-header-top">
          <div class="as-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            AutoScout AI
          </div>
          <button class="as-close" id="autoscout-close" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        ${titleHtml}
      </div>
      <div class="as-body">
        <div class="as-loading">
          <div class="as-spinner"></div>
          <span>Analyzing...</span>
        </div>
      </div>
    `;
    document.body.appendChild(card);

    document.getElementById('autoscout-close').addEventListener('click', () => {
      card.remove();
      restoreTriggerButton();
    });

    return card;
  }

  // ── Result rendering ───────────────────────────────────────────────────────

  const STATUS_LABELS = {
    PASS: 'Apply Now',
    WARNING: 'Consider Carefully',
    FAIL: 'Not Recommended',
  };

  function buildReasonHtml(reason) {
    let pros = [];
    let cons = [];

    if (reason && typeof reason === 'object' && !Array.isArray(reason)) {
      pros = Array.isArray(reason.pros) ? reason.pros.slice(0, 3) : [];
      cons = Array.isArray(reason.cons) ? reason.cons.slice(0, 3) : [];
    } else if (Array.isArray(reason)) {
      // Legacy fallback: treat all items as cons
      cons = reason.slice(0, 4);
    } else if (typeof reason === 'string' && reason) {
      cons = [reason];
    }

    if (!pros.length && !cons.length) {
      return `<div class="as-reason-box as-reason-neutral"><p>No details provided.</p></div>`;
    }

    const prosHtml = pros.length
      ? `<div class="as-reason-box as-reason-pros">
           <span class="as-reason-box-label">Strengths</span>
           <ul>${pros.map(s => `<li>${s}</li>`).join('')}</ul>
         </div>`
      : '';

    const consHtml = cons.length
      ? `<div class="as-reason-box as-reason-cons">
           <span class="as-reason-box-label">Concerns</span>
           <ul>${cons.map(s => `<li>${s}</li>`).join('')}</ul>
         </div>`
      : '';

    return prosHtml + consHtml;
  }

  function renderResult(card, result) {
    const statusClass = result.status === 'PASS'
      ? 'status-pass'
      : result.status === 'WARNING'
        ? 'status-warning'
        : 'status-fail';

    card.classList.add(statusClass);

    const label = STATUS_LABELS[result.status] ?? result.status;
    const score = Math.min(100, Math.max(0, Number(result.match_score) || 0));

    const roleScore   = Math.min(100, Math.max(0, Number(result.role_score)   || 0));
    const skillsScore = Math.min(100, Math.max(0, Number(result.skills_score) || 0));
    const expScore    = Math.min(100, Math.max(0, Number(result.experience_score) || 0));

    const visaOk = result.visa_ok !== false; // default true if field missing
    const visaTileClass = visaOk ? 'visa-ok' : 'visa-fail';
    const visaLabel     = visaOk ? 'Open to Visa Holders' : 'Requires PR / Citizen';
    const visaBadge     = visaOk ? '✓' : '✗';

    card.querySelector('.as-body').innerHTML = `
      <div class="as-score-row">
        <div class="as-verdict">
          <div class="as-dot"></div>
          <span>${label}</span>
        </div>
        <div class="as-score-badge">${score}</div>
      </div>

      <div class="as-score-track">
        <div class="as-score-fill" style="width: 0%"></div>
      </div>

      <div class="as-bento-scores">
        <div class="as-bento-tile">
          <span class="as-tile-label">Role</span>
          <span class="as-tile-num">${roleScore}</span>
          <div class="as-tile-bar-track"><div class="as-tile-bar-fill" data-val="${roleScore}" style="width:0%"></div></div>
        </div>
        <div class="as-bento-tile">
          <span class="as-tile-label">Skills</span>
          <span class="as-tile-num">${skillsScore}</span>
          <div class="as-tile-bar-track"><div class="as-tile-bar-fill" data-val="${skillsScore}" style="width:0%"></div></div>
        </div>
        <div class="as-bento-tile">
          <span class="as-tile-label">Exp</span>
          <span class="as-tile-num">${expScore}</span>
          <div class="as-tile-bar-track"><div class="as-tile-bar-fill" data-val="${expScore}" style="width:0%"></div></div>
        </div>
      </div>

      <div class="as-visa-tile ${visaTileClass}">
        <div class="as-visa-tile-row">
          <div class="as-visa-tile-left">
            <span class="as-tile-label">Visa</span>
            <span class="as-visa-status-text">${visaLabel}</span>
            ${result.visa_check ? `<span class="as-visa-detail">${result.visa_check}</span>` : ''}
          </div>
          <div class="as-visa-tile-right">
            <span class="as-visa-badge">${visaBadge}</span>
          </div>
        </div>
        <div class="as-tile-bar-track" style="margin-top:2px">
          <div class="as-visa-bar" style="width:100%"></div>
        </div>
      </div>

      <div class="as-reason-group">${buildReasonHtml(result.reason)}</div>
    `;

    // Animate all bars after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = card.querySelector('.as-score-fill');
        if (fill) fill.style.width = `${score}%`;
        card.querySelectorAll('.as-tile-bar-fill').forEach((el) => {
          el.style.width = `${el.dataset.val}%`;
        });
      });
    });
  }

  function renderError(card, message) {
    card.querySelector('.as-body').innerHTML = `
      <div class="as-check-item" style="color:#ef4444; gap:8px;">
        <span>⚠️</span>
        <span>${message}</span>
      </div>
    `;
  }

  const TRIGGER_ID = 'autoscout-trigger';

  // Show the trigger button again (used after analysis finishes or card closes)
  function restoreTriggerButton() {
    const btn = document.getElementById(TRIGGER_ID);
    if (!btn) return;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    const label = btn.querySelector('span');
    if (label) label.textContent = 'Analyze this job';
  }

  // ── Manual mode: floating trigger button ───────────────────────────────────

  function buildTriggerButton() {
    if (document.getElementById(TRIGGER_ID)) {
      restoreTriggerButton();
      return;
    }
    const btn = document.createElement('button');
    btn.id = TRIGGER_ID;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>Analyze this job</span>
    `;
    Object.assign(btn.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      background: '#6c63ff',
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
      transition: 'background 0.15s, opacity 0.15s',
    });
    btn.addEventListener('mouseenter', () => { if (!btn.disabled) btn.style.background = '#5a52e0'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#6c63ff'; });
    btn.addEventListener('click', () => {
      // Disable button while analyzing; it will be restored when analysis finishes
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'default';
      const label = btn.querySelector('span');
      if (label) label.textContent = 'Analyzing…';
      run();
    });
    document.body.appendChild(btn);
  }

  // ── Main flow ──────────────────────────────────────────────────────────────

  function run() {
    const jdText = extractJD();
    if (!jdText) {
      restoreTriggerButton();
      return;
    }

    // Remove any existing result card before showing a new one
    document.getElementById(CARD_ID)?.remove();
    const jobTitle = extractJobTitle();
    const card = buildCard(jobTitle);

    chrome.runtime.sendMessage({ action: 'analyze_jd', text: jdText }, (response) => {
      if (chrome.runtime.lastError) {
        renderError(card, chrome.runtime.lastError.message || 'Extension communication error');
        restoreTriggerButton();
        return;
      }
      if (response?.error) {
        renderError(card, response.error);
        restoreTriggerButton();
        return;
      }
      if (response?.result) {
        renderResult(card, response.result);
      } else {
        renderError(card, 'No valid response received.');
      }
      restoreTriggerButton();
    });
  }

  // ── Job title extraction ───────────────────────────────────────────────────

  function extractJobTitle() {
    const host = window.location.hostname;

    if (host.includes('seek.com.au')) {
      const selectors = [
        '[data-automation="job-detail-title"]',
        'h1[class*="Title"]',
        'h1[class*="title"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.innerText?.trim()) return el.innerText.trim();
      }
    }

    if (host.includes('linkedin.com')) {
      const selectors = [
        'h1.jobs-unified-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title h1',
        'h1[class*="job-title"]',
        'h1[class*="jobs"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.innerText?.trim()) return el.innerText.trim();
      }
    }

    // Generic fallback
    const h1 = document.querySelector('main h1, article h1, [role="main"] h1, h1');
    return h1?.innerText?.trim() || '';
  }

  // ── URL / job-page detection ───────────────────────────────────────────────

  function isJobPage() {
    const host = window.location.hostname;
    if (host.includes('seek.com.au')) {
      // Direct job URL (/job/12345678) or split-panel search results (?jobId=...)
      return /\/job\//.test(window.location.pathname) ||
             !!new URLSearchParams(window.location.search).get('jobId');
    }
    if (host.includes('linkedin.com')) {
      return !!new URLSearchParams(window.location.search).get('currentJobId');
    }
    return false;
  }

  function removeStaleUI() {
    document.getElementById(CARD_ID)?.remove();
    document.getElementById(TRIGGER_ID)?.remove();
  }

  // Decide auto vs manual based on stored setting
  function waitAndRun() {
    if (!isJobPage()) return;

    chrome.storage.local.get('autoMode', ({ autoMode }) => {
      const doRun = autoMode === true ? run : buildTriggerButton;

      if (extractJD()) {
        doRun();
        return;
      }

      let attempts = 0;
      const observer = new MutationObserver(() => {
        attempts++;
        if (extractJD() || attempts > 30) {
          observer.disconnect();
          if (extractJD()) doRun();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // ── SPA navigation (LinkedIn changes URL without page reload) ──────────────

  let lastTrackedUrl = location.href;

  function onUrlChange() {
    if (location.href === lastTrackedUrl) return;
    lastTrackedUrl = location.href;
    removeStaleUI();
    setTimeout(waitAndRun, 800);
  }

  const _origPushState = history.pushState;
  history.pushState = function (...args) {
    _origPushState.apply(this, args);
    onUrlChange();
  };
  window.addEventListener('popstate', onUrlChange);

  // ── Boot ───────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndRun);
  } else {
    waitAndRun();
  }
})();
