# AutoScout AI

A Chrome extension that automatically evaluates job listings on **Seek**, **LinkedIn**, **Indeed**, **Glassdoor**, **Otta**, **Hatch**, and **Prosple** against your personal profile using an LLM API, injecting a real-time result card directly onto the page.

---

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="screenshots/popup.png" width="300" alt="Popup — profile setup" /><br/>
      <sub><b>Popup — step-by-step profile setup</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="screenshots/result-card.png" width="300" alt="Result card — job analysis" /><br/>
      <sub><b>Result card — injected on the job page</b></sub>
    </td>
  </tr>
</table>

---

## Features

- **Instant job analysis** — extracts the job description from the current page and scores it against your profile in seconds
- **Multi-dimensional scoring** — overall match score plus Role, Skills, and Experience sub-scores displayed as bento-style tiles
- **Visa eligibility check** — flags whether the role is open to visa holders or restricted to PR / Australian Citizens, with full understanding of Australian work rights (485, PR, student visa, WHV, etc.)
- **Strengths & Concerns** — analysis is split into a green Strengths box and a red Concerns box for fast scanning
- **Resume auto-fill** — upload your PDF résumé and Gemini extracts your profile fields automatically (no manual typing)
- **Multi-provider LLM support** — works with Gemini (recommended, free tier), OpenAI, Claude, DeepSeek, Qwen, and Kimi
- **Auto / Manual mode** — toggle between automatic analysis on every job page or on-demand via a floating "Analyze this job" button
- **Works on SPAs** — handles LinkedIn and Seek's single-page navigation (URL changes without full page reload)
- **Universal manual trigger** — the "Analyze this job" button appears on any supported site even when the page isn't auto-recognised as a job listing

---

## Supported Sites

| Site | URL pattern detected |
|------|----------------------|
| Seek | `/job/...` path **or** `?jobId=...` query param |
| LinkedIn | `?currentJobId=...` query param |
| Indeed | `?jk=...` query param or `/viewjob` path |
| Glassdoor | `/job-listing/`, `/Job/`, `/jobs/` paths |
| Otta | `/jobs/` path |
| Hatch | `/jobs/` or `/role/` path |
| Prosple | `/graduate-jobs/`, `/internships/`, `/jobs/` paths |

On any of these sites, a floating **"Analyze this job"** button also appears on pages that don't match a known URL pattern, so you can manually trigger analysis on any listing.

---

## Installation

> This extension is not on the Chrome Web Store. Load it as an unpacked extension.

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `autoscout-ai` folder
5. The AutoScout AI icon will appear in your toolbar

> **After reloading the extension**, refresh any open job tabs before using it.

---

## Setup

1. Click the AutoScout AI toolbar icon to open the popup
2. **Step 1 — API Configuration**: choose your LLM provider and paste your API key  
   → Gemini is recommended (free tier available at [aistudio.google.com](https://aistudio.google.com/app/apikey))
3. **Step 2 — Resume** *(optional, Gemini only)*: upload your PDF résumé to auto-fill your profile
4. **Step 3 — Profile**: review and edit your profile fields, then click **Save Profile**

---

## LLM Provider Support

| Provider | Model used | Free tier | PDF resume parsing |
|----------|-----------|-----------|-------------------|
| **Gemini ✦ Recommended** | `gemini-2.5-flash-lite` | ✅ Yes | ✅ Yes |
| OpenAI | `gpt-4o-mini` | ❌ | ❌ |
| Claude (Anthropic) | `claude-3-5-haiku` | ❌ | ❌ |
| DeepSeek | `deepseek-chat` | ❌ | ❌ |
| Qwen (Alibaba) | `qwen-plus` | ❌ | ❌ |
| Kimi (Moonshot) | `moonshot-v1-8k` | ❌ | ❌ |

---

## How It Works

```
Job page loads
      │
      ▼
content.js detects job page & extracts JD text
      │
      ▼
background.js (Service Worker) sends JD + profile to the selected LLM API
      │
      ▼
LLM returns structured JSON:
  { status, match_score, role_score, skills_score, experience_score,
    visa_ok, visa_check, reason: { pros[], cons[] } }
      │
      ▼
content.js injects result card into the page
```

**PDF résumé parsing** uses Gemini's multimodal `inlineData` feature — the PDF is sent directly as base64 and Gemini extracts structured profile fields with no client-side PDF library needed.

---

## Result Card

| Element | Description |
|---------|-------------|
| Status bar | Green / Orange / Red strip — PASS / WARNING / FAIL |
| Job title | Extracted from the page, shown in the card header |
| Overall score | 0–100 match score with animated fill bar |
| Role / Skills / Exp tiles | Sub-scores as bento grid tiles with animated bars |
| Visa tile | Green "Open to Visa Holders" or red "Requires PR / Citizen" with one-line explanation |
| Strengths box | Green box listing concrete match strengths |
| Concerns box | Red box listing specific gaps or concerns |

---

## Project Structure

```
autoscout-ai/
├── manifest.json          # Chrome Extension Manifest V3 (v1.1.0)
├── icons/
│   ├── icon48.png
│   └── icon128.png
├── screenshots/
│   ├── popup.png
│   └── result-card.png
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles (light theme)
│   └── popup.js           # Profile save/load, provider switching, resume upload
└── scripts/
    ├── background.js      # Service Worker — multi-provider LLM routing
    ├── content.js         # JD extraction, card injection, SPA navigation
    └── content.css        # Injected card styles
```

---

## Privacy

- Your profile and API key are stored **locally** via `chrome.storage.local` — nothing is sent to any server other than your chosen LLM API
- The job description text and your profile are sent to the LLM solely to generate the match analysis
- No analytics, no tracking, no external servers

---

## Tech Stack

- Chrome Extension Manifest V3
- Google Gemini API (`gemini-2.5-flash-lite`) — default
- OpenAI-compatible API format (OpenAI / DeepSeek / Qwen / Kimi)
- Anthropic Messages API (Claude)
- Vanilla JS / CSS — zero runtime dependencies

---

## License

MIT
