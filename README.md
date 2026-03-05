# AutoScout AI

A Chrome extension that automatically evaluates job listings on **Seek** and **LinkedIn** against your personal profile using the **Google Gemini API**, injecting a real-time result card directly onto the page.

---

## Features

- **Instant job analysis** — extracts the job description from the current page and scores it against your profile in seconds
- **Multi-dimensional scoring** — overall match score plus Role, Skills, and Experience sub-scores displayed as bento-style tiles
- **Visa eligibility check** — prominently flags whether the role is open to visa holders or restricted to PR / Australian Citizens
- **Strengths & Concerns** — analysis is split into a green Strengths box and a red Concerns box for fast scanning
- **Resume auto-fill** — upload your PDF résumé and Gemini extracts your profile fields automatically (no manual typing)
- **Auto / Manual mode** — toggle between automatic analysis on every job page or on-demand via a floating "Analyze this job" button
- **Works on SPAs** — handles LinkedIn and Seek's single-page navigation (URL changes without full page reload)

---

## Supported Sites

| Site | URL pattern detected |
|------|----------------------|
| Seek | `/job/...` path **or** `?jobId=...` query param |
| LinkedIn | `?currentJobId=...` query param |

---

## Installation

> This extension is not on the Chrome Web Store. Load it as an unpacked extension.

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `autoscout-ai` folder
5. The AutoScout AI icon will appear in your toolbar

---

## Setup

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click the AutoScout AI toolbar icon to open the popup
3. **Step 1 — API Key**: paste your Gemini API key
4. **Step 2 — Resume** *(optional)*: upload your PDF résumé to auto-fill your profile
5. **Step 3 — Profile**: review and edit your profile fields, then click **Save Profile**

---

## How It Works

```
Job page loads
      │
      ▼
content.js extracts the job description text
      │
      ▼
background.js (Service Worker) sends JD + profile to Gemini API
      │
      ▼
Gemini returns structured JSON:
  { status, match_score, role_score, skills_score, experience_score,
    visa_ok, visa_check, reason: { pros, cons } }
      │
      ▼
content.js injects result card into the page
```

**PDF résumé parsing** uses Gemini's multimodal `inlineData` feature — the PDF is sent directly as base64 and Gemini extracts structured profile fields with no client-side PDF library needed.

---

## Project Structure

```
autoscout-ai/
├── manifest.json          # Chrome Extension Manifest V3
├── icons/
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles (light theme)
│   └── popup.js           # Profile save/load, resume upload logic
└── scripts/
    ├── background.js      # Service Worker — Gemini API calls
    ├── content.js         # JD extraction, card injection, SPA navigation
    └── content.css        # Injected card styles
```

---

## Result Card

| Element | Description |
|---------|-------------|
| Status bar | Green / Orange / Red strip indicating PASS / WARNING / FAIL |
| Job title | Extracted from the page and shown in the card header |
| Overall score | 0–100 match score |
| Role / Skills / Exp tiles | Sub-scores as bento grid tiles with animated bars |
| Visa tile | Green "Open to Visa Holders" or red "Requires PR / Citizen" |
| Strengths box | Green box listing specific match strengths |
| Concerns box | Red box listing specific gaps or concerns |

---

## Privacy

- Your profile and API key are stored locally via `chrome.storage.local` — nothing is sent to any server other than the Google Gemini API
- The job description text and your profile are sent to Gemini solely to generate the match analysis
- No analytics, no tracking, no external servers

---

## Tech Stack

- Chrome Extension Manifest V3
- Google Gemini API (`gemini-2.5-flash-lite`)
- Vanilla JS / CSS — zero runtime dependencies

---

## License

MIT
