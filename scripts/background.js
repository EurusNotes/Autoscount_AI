'use strict';

const PROFILE_KEYS = ['apiKey', 'education', 'visaStatus', 'targetRole', 'skills', 'experience', 'workHistory'];
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

function geminiApiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildSystemPrompt(profile) {
  const workLine = profile.workHistory
    ? `\nWork/Projects: ${profile.workHistory.slice(0, 400)}`
    : '';
  return `You are a strict IT recruiter. Evaluate how well the given JD matches the candidate and output JSON only.
Candidate: education=${profile.education || 'unknown'} | visa=${profile.visaStatus || 'unknown'} | target=${profile.targetRole || 'unknown'} | skills=${profile.skills || 'unknown'} | experience=${profile.experience || 'unknown'}${workLine}
Hard-fail rules (set status to FAIL): JD requires "Australian Citizen only", "PR only", "permanent resident", or "Baseline clearance" and candidate visa does not qualify; OR JD requires "Senior", "Lead", or "5+ years" and candidate experience is insufficient.
Output strict JSON (no Markdown): {"status":"PASS|WARNING|FAIL","match_score":0-100,"role_score":0-100,"skills_score":0-100,"experience_score":0-100,"visa_ok":true,"visa_check":"...","experience_check":"...","reason":{"pros":["strength 1"],"cons":["gap 1"]}}
visa_ok must be false if the JD restricts to Australian Citizen/PR/permanent resident/Baseline clearance and candidate visa does not qualify, otherwise true.
reason.pros = list of 1–3 concrete match strengths (omit array if none). reason.cons = list of 1–3 concrete gaps or concerns (omit array if none). Each item must be one concise sentence. No full paragraphs.`;
}

// ── Gemini API call ───────────────────────────────────────────────────────────

async function callLLM(apiKey, systemPrompt, jdText) {
  const response = await fetch(geminiApiUrl(apiKey), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `JD:\n${jdText}` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 400,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Gemini API request failed (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawContent) throw new Error('Empty response from Gemini');

  return JSON.parse(rawContent);
}

// ── Resume parser ─────────────────────────────────────────────────────────────

async function parseResumePDF(apiKey, base64) {
  const response = await fetch(geminiApiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64,
            },
          },
          {
            text: `Extract the candidate's profile from this resume. Output strict JSON only (no Markdown):
{"education":"degree and university","visaStatus":"visa type and work rights if mentioned, else empty string","targetRole":"most recent or target job title","skills":"comma-separated key technical skills","experience":"years of experience or level e.g. 0-1 year / 2-3 years","workHistory":"brief summary of work roles and notable projects, max 3 sentences"}`,
          },
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
    const errBody = await response.text().catch(() => '');
    throw new Error(`Gemini API request failed (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawContent) throw new Error('Empty response from Gemini');

  return JSON.parse(rawContent);
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ── Parse resume ──
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
      const profile = await new Promise((resolve, reject) => {
        chrome.storage.local.get(PROFILE_KEYS, (data) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(data);
        });
      });

      if (!profile.apiKey) {
        sendResponse({ error: 'Please add your API Key in the extension settings.' });
        return;
      }

      const systemPrompt = buildSystemPrompt(profile);
      const result = await callLLM(profile.apiKey, systemPrompt, jdText);

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
