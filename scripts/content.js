(() => {
  'use strict';

  const CARD_ID = 'autoscout-card';

  // Avoid duplicate injection on the same page
  if (document.getElementById(CARD_ID)) return;

  // Guard: returns false if the extension was reloaded/invalidated while this
  // content script is still running on the tab.
  function isExtensionAlive() {
    try { return !!chrome.runtime?.id; } catch (_) { return false; }
  }

  // Clean up all injected UI and stop any further activity when context dies
  function handleContextInvalidated() {
    document.getElementById(CARD_ID)?.remove();
    document.getElementById(TRIGGER_ID)?.remove();
  }

  // ── JD extraction ──────────────────────────────────────────────────────────

  function cleanText(raw) {
    return raw
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 2000);
  }

  // Try a list of CSS selectors, return the first match with meaningful text
  function extractBySelectors(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.innerText?.trim().length > 100) return el.innerText.trim();
    }
    return null;
  }

  // Generic fallback: pick the longest content block, then body
  function extractGenericJD() {
    const candidates = [...document.querySelectorAll(
      'article, main, [role="main"], section, ' +
      '[class*="job-description"], [class*="jobDescription"], ' +
      '[class*="job-detail"], [id*="job-description"], [id*="jobDescription"]'
    )];
    let best = '';
    for (const el of candidates) {
      const t = el.innerText?.trim() || '';
      if (t.length > best.length) best = t;
    }
    return best.length >= 100 ? best : null;
  }

  function extractJD() {
    const host = window.location.hostname;
    let text = null;

    if (host.includes('seek.com.au')) {
      text = extractBySelectors([
        '[data-automation="jobAdDetails"]', '.jobAdDetails',
        '[class*="jobDescription"]', 'article[class*="job"]',
      ]);
    } else if (host.includes('linkedin.com')) {
      text = extractBySelectors([
        '.jobs-description__content', '.jobs-box__html-content',
        '[class*="job-description"]', '.description__text',
      ]);
    } else if (host.includes('indeed.com')) {
      text = extractBySelectors([
        '#jobDescriptionText', '.jobsearch-jobDescriptionText',
        '[class*="jobDescriptionText"]', '[class*="jobDescription"]',
      ]);
    } else if (host.includes('glassdoor.com')) {
      text = extractBySelectors([
        '[class*="JobDetails_jobDescription"]', '[class*="jobDescriptionContent"]',
        '[class*="desc__"]', '.desc',
      ]);
    } else if (host.includes('otta.com')) {
      text = extractBySelectors([
        '[class*="JobDescription"]', '[class*="job-description"]',
        '[class*="RoleDescription"]', 'main',
      ]);
    } else if (host.includes('hatch.team')) {
      text = extractBySelectors([
        '[class*="job-description"]', '[class*="jobDescription"]',
        '[class*="role-description"]', '[class*="description"]', 'main',
      ]);
    } else if (host.includes('prosple.com')) {
      text = extractBySelectors([
        '[class*="job-description"]', '[class*="opportunity-description"]',
        '[class*="description"]', 'main',
      ]);
    }

    // Generic fallback for unlisted sites or when site-specific selectors miss
    if (!text) text = extractGenericJD();
    if (!text || text.length < 100) text = document.body.innerText.trim();

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
          <span class="as-loading-timer">0s</span>
        </div>
        <p class="as-loading-slow" style="display:none">Taking longer than usual, please wait…</p>
      </div>
    `;
    document.body.appendChild(card);

    // ── Restore saved position ────────────────────────────────────────────────
    if (isExtensionAlive()) {
      try {
        chrome.storage.local.get('cardPos', ({ cardPos }) => {
          if (cardPos?.top && cardPos?.left) {
            card.style.top   = cardPos.top;
            card.style.left  = cardPos.left;
            card.style.right = 'auto';
          }
        });
      } catch (_) {}
    }

    // ── Drag to reposition ────────────────────────────────────────────────────
    const headerEl = card.querySelector('.as-header');
    headerEl.style.cursor = 'grab';

    headerEl.addEventListener('mousedown', (e) => {
      // Ignore clicks on the close button
      if (e.target.closest('.as-close')) return;

      e.preventDefault();
      headerEl.style.cursor = 'grabbing';

      const rect    = card.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      function onMove(e) {
        const newLeft = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth  - card.offsetWidth));
        const newTop  = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - card.offsetHeight));
        card.style.left  = newLeft + 'px';
        card.style.top   = newTop  + 'px';
        card.style.right = 'auto';
      }

      function onUp() {
        headerEl.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        // Persist position
        if (isExtensionAlive()) {
          try {
            chrome.storage.local.set({ cardPos: { top: card.style.top, left: card.style.left } });
          } catch (_) {}
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

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
      background: '#16a34a',
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(22,163,74,0.4)',
      transition: 'background 0.15s, opacity 0.15s',
    });
    btn.addEventListener('mouseenter', () => { if (!btn.disabled) btn.style.background = '#15803d'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#16a34a'; });
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

    // ── Elapsed-time counter ──────────────────────────────────────────────────
    let elapsed = 0;
    const timerEl = card.querySelector('.as-loading-timer');
    const slowEl  = card.querySelector('.as-loading-slow');
    const timerInterval = setInterval(() => {
      elapsed++;
      if (timerEl) timerEl.textContent = `${elapsed}s`;
      if (slowEl && elapsed >= 15) slowEl.style.display = 'block';
    }, 1000);

    function stopTimer() { clearInterval(timerInterval); }

    if (!isExtensionAlive()) {
      stopTimer();
      renderError(card, 'Extension was reloaded — please refresh this page.');
      restoreTriggerButton();
      return;
    }
    try {
      chrome.runtime.sendMessage({ action: 'analyze_jd', text: jdText }, (response) => {
        stopTimer();
        // Guard inside the async callback — context may have died by the time
        // this fires, making chrome.runtime.lastError itself throw a TypeError.
        try {
          if (!isExtensionAlive() || chrome.runtime.lastError) {
            const msg = isExtensionAlive()
              ? (chrome.runtime.lastError?.message || 'Extension communication error')
              : 'Extension was reloaded — please refresh this page.';
            renderError(card, msg);
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
        } catch (_) {
          renderError(card, 'Extension was reloaded — please refresh this page.');
          restoreTriggerButton();
        }
      });
    } catch (_) {
      stopTimer();
      renderError(card, 'Extension was reloaded — please refresh this page.');
      restoreTriggerButton();
    }
  }

  // ── Job title extraction ───────────────────────────────────────────────────

  function extractJobTitle() {
    const host = window.location.hostname;

    const SITE_SELECTORS = {
      'seek.com.au': [
        '[data-automation="job-detail-title"]',
        'h1[class*="Title"]', 'h1[class*="title"]',
      ],
      'linkedin.com': [
        'h1.jobs-unified-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title h1',
        'h1[class*="job-title"]', 'h1[class*="jobs"]',
      ],
      'indeed.com': [
        'h1.jobsearch-JobInfoHeader-title',
        'h1[class*="jobTitle"]', 'h1[class*="job-title"]',
      ],
      'glassdoor.com': [
        'h1[class*="JobDetails_jobTitle"]',
        'h1[class*="title"]', 'h1[data-test="job-title"]',
      ],
      'otta.com': [
        'h1[class*="JobTitle"]', 'h1[class*="job-title"]', 'h1',
      ],
      'hatch.team': [
        'h1[class*="title"]', 'h1[class*="Title"]', 'h1',
      ],
      'prosple.com': [
        'h1[class*="title"]', 'h1[class*="Title"]', 'h1',
      ],
    };

    for (const [domain, selectors] of Object.entries(SITE_SELECTORS)) {
      if (host.includes(domain)) {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.innerText?.trim()) return el.innerText.trim();
        }
        break;
      }
    }

    // Generic fallback
    const h1 = document.querySelector('main h1, article h1, [role="main"] h1, h1');
    return h1?.innerText?.trim() || '';
  }

  // ── URL / job-page detection ───────────────────────────────────────────────

  // Heuristic check for unlisted or unrecognised pages
  function isGenericJobPage() {
    const text = (document.body?.innerText || '').toLowerCase();
    if (text.length < 300) return false;
    const keywords = [
      'responsibilities', 'requirements', 'qualifications',
      'we are looking for', 'about the role', 'what you will do',
      'key skills', 'experience required', 'apply now', 'job description',
    ];
    return keywords.filter(k => text.includes(k)).length >= 2;
  }

  function isJobPage() {
    const { hostname, pathname, search } = window.location;
    const params = new URLSearchParams(search);

    if (hostname.includes('seek.com.au'))
      return /\/job\//.test(pathname) || !!params.get('jobId');

    if (hostname.includes('linkedin.com'))
      return !!params.get('currentJobId');

    if (hostname.includes('indeed.com'))
      return !!params.get('jk') || /\/viewjob/.test(pathname);

    if (hostname.includes('glassdoor.com'))
      return /\/job-listing\//.test(pathname) || /\/Job\//.test(pathname) || /\/jobs\//.test(pathname);

    if (hostname.includes('otta.com'))
      return /\/jobs\//.test(pathname);

    if (hostname.includes('hatch.team'))
      return /\/jobs\//.test(pathname) || /\/role\//.test(pathname);

    if (hostname.includes('prosple.com'))
      return /\/graduate-jobs\//.test(pathname) || /\/internships\//.test(pathname) || /\/jobs\//.test(pathname);

    // Generic fallback for any other site in the manifest
    return isGenericJobPage();
  }

  function removeStaleUI() {
    document.getElementById(CARD_ID)?.remove();
    document.getElementById(TRIGGER_ID)?.remove();
    // Clear saved card position so each new job starts at the default corner
    if (isExtensionAlive()) {
      try { chrome.storage.local.remove('cardPos'); } catch (_) {}
    }
  }

  // Decide auto vs manual based on stored setting
  function waitAndRun() {
    if (!isExtensionAlive()) return;
    try {
    chrome.storage.local.get('autoMode', ({ autoMode }) => {
      if (!isJobPage()) {
        // Page not recognised as a job listing — always show manual button
        // so the user can still trigger analysis themselves
        buildTriggerButton();
        return;
      }

      const doRun = autoMode === true ? run : buildTriggerButton;

      if (extractJD()) {
        doRun();
        return;
      }

      // JD not in DOM yet — wait for it (SPA lazy-load)
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
    } catch (_) { handleContextInvalidated(); }
  }

  // ── SPA navigation (LinkedIn changes URL without page reload) ──────────────

  let lastTrackedUrl = location.href;

  function onUrlChange() {
    if (location.href === lastTrackedUrl) return;
    if (!isExtensionAlive()) { handleContextInvalidated(); return; }
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
