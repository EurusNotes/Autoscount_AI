const FIELDS = ['apiKey', 'apiProvider', 'outputLanguage', 'education', 'visaStatus', 'targetRole', 'skills', 'experience', 'workHistory'];

// Per-provider UI metadata
const PROVIDER_META = {
  gemini:   { label: 'Gemini API Key',    placeholder: 'AIza...',      hint: 'Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com</a>' },
  openai:   { label: 'OpenAI API Key',    placeholder: 'sk-...',        hint: 'Get a key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>' },
  claude:   { label: 'Anthropic API Key', placeholder: 'sk-ant-...',    hint: 'Get a key at <a href="https://console.anthropic.com/" target="_blank">console.anthropic.com</a>' },
  deepseek: { label: 'DeepSeek API Key',  placeholder: 'sk-...',        hint: 'Get a key at <a href="https://platform.deepseek.com/" target="_blank">platform.deepseek.com</a>' },
  qwen:     { label: 'DashScope API Key', placeholder: 'sk-...',        hint: 'Get a key at <a href="https://dashscope.console.aliyun.com/" target="_blank">dashscope.console.aliyun.com</a>' },
  kimi:     { label: 'Moonshot API Key',  placeholder: 'sk-...',        hint: 'Get a key at <a href="https://platform.moonshot.cn/" target="_blank">platform.moonshot.cn</a>' },
};

// ── Toast ──────────────────────────────────────────────────────────────────────

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Provider UI ────────────────────────────────────────────────────────────────

function updateProviderUI(provider) {
  const meta = PROVIDER_META[provider] || PROVIDER_META.gemini;
  document.getElementById('apiKeyLabel').textContent = meta.label;
  document.getElementById('apiKey').placeholder = meta.placeholder;
  document.getElementById('apiKeyHint').innerHTML = meta.hint;

  // PDF parsing only works with Gemini
  const note = document.getElementById('resumeProviderNote');
  const uploadBtn = document.querySelector('.btn-upload');
  if (provider && provider !== 'gemini') {
    note.style.display = 'block';
    uploadBtn.style.opacity = '0.45';
    uploadBtn.style.pointerEvents = 'none';
    uploadBtn.title = 'PDF parsing requires Gemini';
  } else {
    note.style.display = 'none';
    uploadBtn.style.opacity = '';
    uploadBtn.style.pointerEvents = '';
    uploadBtn.title = '';
  }
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

    // Apply provider-specific UI after values are loaded
    const provider = data.apiProvider || 'gemini';
    document.getElementById('apiProvider').value = provider;
    updateProviderUI(provider);

    // Refresh char counter after textarea value is set
    document.getElementById('workHistory')?.dispatchEvent(new Event('input'));

    const isAuto = data.autoMode === true;
    document.getElementById('autoModeToggle').checked = isAuto;
    applyModeUI(isAuto);
  });
}

function setKeyStatus(state, text) {
  const el = document.getElementById('keyStatus');
  el.className = `key-status ${state}`;
  el.textContent = text;
}

function persistProfile(profile) {
  chrome.storage.local.set(profile, () => {
    if (chrome.runtime.lastError) {
      showToast('Save failed, please try again', true);
    } else {
      showToast('✓ Profile saved');
    }
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
    highlightApiKeyField();
    return;
  }

  // If the key hasn't changed from what's already stored, skip validation
  // and save immediately — this prevents profile updates from being blocked
  // by a transient API error on the validation call.
  chrome.storage.local.get('apiKey', ({ apiKey: storedKey }) => {
    if (storedKey && storedKey === profile.apiKey) {
      setKeyStatus('valid', '✓ Valid');
      persistProfile(profile);
      return;
    }

    // Key is new or changed — validate before saving
    const saveBtn = document.getElementById('saveBtn');
    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<div class="parse-spinner"></div> Validating…`;
    setKeyStatus('validating', 'Checking…');

    chrome.runtime.sendMessage(
      { action: 'validate_key', provider: profile.apiProvider || 'gemini', apiKey: profile.apiKey },
      (response) => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;

        if (chrome.runtime.lastError || !response?.valid) {
          const msg = response?.error || chrome.runtime.lastError?.message || 'Validation failed';
          setKeyStatus('invalid', '✗ Invalid');
          showToast(msg, true);
          return;
        }

        setKeyStatus('valid', '✓ Valid');
        persistProfile(profile);
      }
    );
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

  const provider = document.getElementById('apiProvider').value || 'gemini';
  if (provider !== 'gemini') {
    setParseStatus('error', 'PDF parsing requires Gemini. Switch provider to Gemini.');
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

function setupWorkHistoryCounter() {
  const textarea = document.getElementById('workHistory');
  const counter  = document.getElementById('workHistoryCount');
  const hint     = document.getElementById('workHistoryHint');
  const LIMIT    = 400;

  function update() {
    const len = textarea.value.length;
    counter.textContent = `${len} / ${LIMIT}`;
    const over = len > LIMIT;
    counter.classList.toggle('over', over);
    hint.style.display = over ? 'block' : 'none';
  }

  textarea.addEventListener('input', update);
  update(); // initialise on load
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupVisibilityToggle();
  setupModeToggle();
  setupResumeUpload();
  setupWorkHistoryCounter();
  document.getElementById('profileForm').addEventListener('submit', saveProfile);

  // Update key label/placeholder/hint live when provider changes
  document.getElementById('apiProvider').addEventListener('change', (e) => {
    updateProviderUI(e.target.value);
    setKeyStatus('', ''); // clear stale validation badge on provider switch
  });

  // Clear validation badge when the key is edited
  document.getElementById('apiKey').addEventListener('input', () => setKeyStatus('', ''));
});
