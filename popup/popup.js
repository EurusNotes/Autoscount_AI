const FIELDS = ['apiKey', 'education', 'visaStatus', 'targetRole', 'skills', 'experience', 'workHistory'];

// ── Toast ──────────────────────────────────────────────────────────────────────

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Mode toggle ────────────────────────────────────────────────────────────────

function applyModeUI(isAuto) {
  const desc = document.getElementById('modeDesc');
  if (isAuto) {
    desc.textContent = 'Auto — analyzes every job page';
    desc.classList.add('active');
  } else {
    desc.textContent = 'Manual — trigger on demand';
    desc.classList.remove('active');
  }
}

// ── Profile load / save ────────────────────────────────────────────────────────

function loadProfile() {
  chrome.storage.local.get([...FIELDS, 'autoMode'], (data) => {
    FIELDS.forEach((key) => {
      const el = document.getElementById(key);
      if (el && data[key]) el.value = data[key];
    });

    const isAuto = data.autoMode === true;
    document.getElementById('autoModeToggle').checked = isAuto;
    applyModeUI(isAuto);
  });
}

function saveProfile(e) {
  e.preventDefault();

  const profile = {};
  FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el) profile[key] = el.value.trim();
  });

  if (!profile.apiKey) {
    showToast('Please enter your API Key first', true);
    document.getElementById('apiKey').focus();
    return;
  }

  chrome.storage.local.set(profile, () => {
    if (chrome.runtime.lastError) {
      showToast('Save failed, please try again', true);
    } else {
      showToast('✓ Profile saved');
    }
  });
}

// ── Resume PDF parsing ─────────────────────────────────────────────────────────

function setParseStatus(state, message) {
  const el = document.getElementById('parseStatus');
  el.className = `parse-status visible ${state}`;
  if (state === 'loading') {
    el.innerHTML = `<div class="parse-spinner"></div><span>${message}</span>`;
  } else if (state === 'success') {
    el.innerHTML = `<span>✓ ${message}</span>`;
  } else {
    el.innerHTML = `<span>⚠ ${message}</span>`;
  }
}

function fillProfileFromParsed(profile) {
  const profileFields = ['education', 'visaStatus', 'targetRole', 'skills', 'experience', 'workHistory'];
  profileFields.forEach((key) => {
    const el = document.getElementById(key);
    if (el && profile[key]) el.value = profile[key];
  });
}

function highlightApiKeyField() {
  const input = document.getElementById('apiKey');
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  input.focus();
  input.style.transition = 'box-shadow 0.15s, border-color 0.15s';
  input.style.borderColor = '#dc2626';
  input.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.15)';
  setTimeout(() => {
    input.style.borderColor = '';
    input.style.boxShadow = '';
  }, 2000);
}

function handleResumeUpload(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') {
    showToast('Please select a PDF file', true);
    return;
  }

  // Read API key directly from the input — no need to save first
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) {
    highlightApiKeyField();
    setParseStatus('error', 'Enter your API Key above first');
    return;
  }

  const label = document.getElementById('uploadLabel');
  label.textContent = file.name.length > 28 ? file.name.slice(0, 25) + '…' : file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result.split(',')[1];
    setParseStatus('loading', 'Parsing resume…');

    chrome.runtime.sendMessage(
      { action: 'parse_resume', base64, apiKey },
      (response) => {
        if (chrome.runtime.lastError) {
          setParseStatus('error', chrome.runtime.lastError.message || 'Extension error');
          return;
        }
        if (response?.error) {
          setParseStatus('error', response.error);
          return;
        }
        if (response?.profile) {
          fillProfileFromParsed(response.profile);
          setParseStatus('success', 'Fields filled — review and save');
        }
      }
    );
  };
  reader.onerror = () => setParseStatus('error', 'Could not read the file');
  reader.readAsDataURL(file);
}

// ── Misc setup ─────────────────────────────────────────────────────────────────

function setupVisibilityToggle() {
  document.querySelectorAll('.toggle-visibility').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });
}

function setupModeToggle() {
  const toggle = document.getElementById('autoModeToggle');
  toggle.addEventListener('change', () => {
    const isAuto = toggle.checked;
    chrome.storage.local.set({ autoMode: isAuto });
    applyModeUI(isAuto);
  });
}

function setupResumeUpload() {
  const input = document.getElementById('resumeFile');
  input.addEventListener('change', () => handleResumeUpload(input.files[0]));

  const label = document.querySelector('.btn-upload');
  label.addEventListener('dragover', (e) => { e.preventDefault(); label.style.borderStyle = 'solid'; });
  label.addEventListener('dragleave', () => { label.style.borderStyle = 'dashed'; });
  label.addEventListener('drop', (e) => {
    e.preventDefault();
    label.style.borderStyle = 'dashed';
    handleResumeUpload(e.dataTransfer.files[0]);
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupVisibilityToggle();
  setupModeToggle();
  setupResumeUpload();
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
});
