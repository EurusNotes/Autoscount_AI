'use strict';

const PROFILE_KEYS = ['apiKey', 'apiProvider', 'education', 'visaStatus', 'targetRole', 'skills', 'experience', 'workHistory'];
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// ── Provider config ───────────────────────────────────────────────────────────

// OpenAI-compatible providers: base URL, model, whether the endpoint supports
// response_format: { type: 'json_object' }
const OPENAI_COMPAT = {
  openai:   { base: 'https://api.openai.com',                         model: 'gpt-4o-mini',       jsonMode: true  },
  deepseek: { base: 'https://api.deepseek.com',                       model: 'deepseek-chat',     jsonMode: true  },
  qwen:     { base: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-plus',         jsonMode: true  },
  kimi:     { base: 'https://api.moonshot.cn',                        model: 'moonshot-v1-8k',    jsonMode: false },
};

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildSystemPrompt(profile) {
  const workLine = profile.workHistory
    ? `\nWork/Projects: ${profile.workHistory.slice(0, 400)}`
    : '';
  return `You are a strict Australian IT recruiter. Evaluate how well the given JD matches the candidate and output JSON only.
Candidate: education=${profile.education || 'unknown'} | visa=${profile.visaStatus || 'unknown'} | target=${profile.targetRole || 'unknown'} | skills=${profile.skills || 'unknown'} | experience=${profile.experience || 'unknown'}${workLine}

Australian work rights reference (use this to evaluate visa_ok):
FULL work rights (qualifies for any role requiring "full work rights", "unrestricted work rights", or "must have right to work"):
  - Australian Citizen
  - Permanent Resident (PR) — subclass 189, 190, 186, 187, 887, 100, etc.
  - New Zealand Citizen (subclass 444)
  - Subclass 485 (Graduate Temporary / Post-Study Work) — unlimited hours, any employer
  - Partner/Spouse visa with full work conditions (subclass 820, 801, 309, 100)
  - Bridging visa A or B with work rights granted
LIMITED or NO work rights (does NOT satisfy "full work rights"):
  - Student visa (subclass 500) — capped at 48 hrs/fortnight during semester
  - Working Holiday (417/462) — employer and duration restrictions apply; flag as WARNING not automatic FAIL unless JD explicitly excludes WHV
  - Tourist/visitor visa — no work rights
RESTRICTED roles — set visa_ok=false if JD requires any of:
  - "Australian Citizen only", "must be Australian Citizen", "Citizen only"
  - "Permanent Resident", "PR or Citizen", "PR only"
  - "Baseline/NV1/NV2/PV security clearance" (requires citizenship)

Hard-fail rules (set status=FAIL): visa is restricted AND candidate does not qualify; OR JD requires "Senior", "Lead", or "5+ years" and candidate experience is clearly insufficient.
Output strict JSON (no Markdown): {"status":"PASS|WARNING|FAIL","match_score":0-100,"role_score":0-100,"skills_score":0-100,"experience_score":0-100,"visa_ok":true|false,"visa_check":"one sentence explaining the visa assessment","experience_check":"...","reason":{"pros":["strength 1"],"cons":["gap 1"]}}
visa_ok=false only when the JD explicitly restricts to citizens/PR/clearance and the candidate visa does not qualify. If JD says "full work rights" and candidate holds 485 or PR, visa_ok=true.
reason.pros = 1–3 concrete match strengths (omit if none). reason.cons = 1–3 concrete gaps (omit if none). One concise sentence each.`;
}

// ── JSON helper ───────────────────────────────────────────────────────────────

function safeParseJSON(raw) {
  // Strip markdown code fences that some models add despite instructions
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

// ── Gemini ────────────────────────────────────────────────────────────────────

function geminiApiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

async function callGemini(apiKey, systemPrompt, jdText) {
  const response = await fetch(geminiApiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: `JD:\n${jdText}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 450,
      },
    }),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty response from Gemini');
  return safeParseJSON(raw);
}

// ── OpenAI-compatible (OpenAI / DeepSeek / Qwen / Kimi) ──────────────────────

async function callOpenAICompat(apiKey, provider, systemPrompt, jdText) {
  const cfg = OPENAI_COMPAT[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);

  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: `JD:\n${jdText}` },
    ],
    temperature: 0.1,
    max_tokens: 450,
  };
  if (cfg.jsonMode) body.response_format = { type: 'json_object' };

  const response = await fetch(`${cfg.base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`${provider} API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`Empty response from ${provider}`);
  return safeParseJSON(raw);
}

// ── Claude (Anthropic) ────────────────────────────────────────────────────────

async function callClaude(apiKey, systemPrompt, jdText) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 450,
      system: systemPrompt,
      messages: [{ role: 'user', content: `JD:\n${jdText}` }],
    }),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Claude API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data?.content?.[0]?.text;
  if (!raw) throw new Error('Empty response from Claude');
  return safeParseJSON(raw);
}

// ── Provider router ───────────────────────────────────────────────────────────

async function callLLM(provider, apiKey, systemPrompt, jdText) {
  const p = provider || 'gemini';
  if (p === 'gemini')  return callGemini(apiKey, systemPrompt, jdText);
  if (p === 'claude')  return callClaude(apiKey, systemPrompt, jdText);
  return callOpenAICompat(apiKey, p, systemPrompt, jdText);
}

// ── Resume parser (Gemini multimodal only) ────────────────────────────────────

async function parseResumePDF(apiKey, base64) {
  const response = await fetch(geminiApiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
          { text: `Extract the candidate's profile from this resume. Output strict JSON only (no Markdown):
{"education":"degree and university","visaStatus":"visa type and work rights if mentioned, else empty string","targetRole":"most recent or target job title","skills":"comma-separated key technical skills","experience":"years of experience or level e.g. 0-1 year / 2-3 years","workHistory":"brief summary of work roles and notable projects, max 3 sentences"}` },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 450,
      },
    }),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Empty response from Gemini');
  return safeParseJSON(raw);
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ── Parse resume (Gemini only) ──
  if (message.action === 'parse_resume') {
    if (!message.base64) {
      sendResponse({ error: 'No PDF data received.' });
      return true;
    }
    (async () => {
      try {
        const profile = await parseResumePDF(message.apiKey, message.base64);
        sendResponse({ profile });
      } catch (err) {
        sendResponse({ error: err.message || 'Unknown error' });
      }
    })();
    return true;
  }

  // ── Analyze JD ──
  if (message.action !== 'analyze_jd') return false;

  const jdText = message.text;
  if (!jdText || jdText.trim().length < 50) {
    sendResponse({ error: 'Could not extract a valid job description from this page.' });
    return true;
  }

  (async () => {
    try {
      const stored = await new Promise((resolve, reject) => {
        chrome.storage.local.get(PROFILE_KEYS, (data) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(data);
        });
      });

      if (!stored.apiKey) {
        sendResponse({ error: 'Please add your API Key in the extension settings.' });
        return;
      }

      const systemPrompt = buildSystemPrompt(stored);
      const result = await callLLM(stored.apiProvider, stored.apiKey, systemPrompt, jdText);

      if (!result.status || !['PASS', 'WARNING', 'FAIL'].includes(result.status)) {
        throw new Error('Invalid status value returned by the model.');
      }

      sendResponse({ result });
    } catch (err) {
      sendResponse({ error: err.message || 'Unknown error' });
    }
  })();

  return true;
});
