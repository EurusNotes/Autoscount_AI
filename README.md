# AutoScout AI

> **Stop reading every job description from start to finish.**  
> AutoScout AI analyses job listings against your personal profile in seconds — right on the page — and tells you whether to apply, what your strengths are, and where the gaps are.

<table>
  <tr>
    <td align="center" width="50%">
      <img src="screenshots/popup.png" width="300" alt="Popup — profile setup" /><br/>
      <sub><b>Step-by-step profile setup</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="screenshots/result-card.png" width="300" alt="Result card — job analysis" /><br/>
      <sub><b>Real-time match card injected on the job page</b></sub>
    </td>
  </tr>
</table>

---

## Features

| Feature | Details |
|---------|---------|
| **Instant job analysis** | Extracts the JD and scores it against your profile in seconds |
| **Multi-dimensional scoring** | Overall match + Role / Skills / Experience sub-scores |
| **Visa eligibility check** | Understands Australian work rights — 485, PR, WHV, student visa, and more |
| **Strengths & Concerns** | Separate green / red boxes with bullet-point analysis |
| **Resume auto-fill** | Upload your PDF and Gemini fills your profile automatically |
| **Multi-language output** | Results in English, 中文, हिन्दी, or 日本語 |
| **Multi-provider LLM** | Gemini (free), OpenAI, Claude, DeepSeek, Qwen, Kimi |
| **Auto / Manual mode** | Analyse every job page automatically, or on-demand only |
| **API key validation** | Key is verified live when you save — instant feedback |
| **Draggable result card** | Reposition the card anywhere on the page; position is remembered |

---

## Supported Sites

| Site | Detection method |
|------|-----------------|
| **Seek** | `/job/` path or `?jobId=` query param |
| **LinkedIn** | `?currentJobId=` query param |
| **Indeed** | `?jk=` query param or `/viewjob` path |
| **Glassdoor** | `/job-listing/`, `/Job/`, `/jobs/` paths |
| **Otta** | `/jobs/` path |
| **Prosple** | `/graduate-jobs/`, `/internships/`, `/jobs/` paths |

> On any other site, a floating **"Analyze this job"** button appears if the page looks like a job listing, so you can trigger analysis manually anywhere.

---

## Installation

### Option A — Chrome Web Store *(recommended)*

Search for **AutoScout AI** on the [Chrome Web Store](https://chrome.google.com/webstore) and click **Add to Chrome**.

### Option B — Load unpacked (developer mode)

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `autoscout-ai` folder
6. The AutoScout AI icon appears in your toolbar

> After reloading or updating the extension, refresh any open job tabs before using it.

---

## Setup Guide

### Step 1 — Get an API Key

Click the AutoScout AI icon in your toolbar to open the settings panel.

**Recommended: Gemini (free tier)**

Gemini has a generous free quota — no credit card required.

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API key**
3. Copy the key (starts with `AIza...`)
4. In the popup, make sure **Provider** is set to `Gemini ✦ Recommended`
5. Paste the key into the **API Key** field

> When you save, the extension sends a lightweight test request to verify the key. A green **✓ Valid** badge confirms it worked.

**Using a different provider?**

Select your provider from the dropdown and enter the corresponding key. See the [LLM Provider table](#llm-provider-support) below for links to each provider's key page.

---

### Step 2 — Upload Your Résumé *(optional, Gemini only)*

Uploading your PDF résumé lets Gemini auto-fill your profile — no manual typing needed.

1. Make sure your Gemini API key is entered (Step 1)
2. Click **Upload PDF Resume** or drag-and-drop your PDF
3. Wait a few seconds while Gemini extracts your details
4. Review the filled fields and correct anything if needed

> PDF parsing only works with the Gemini provider. If you are using OpenAI, Claude, or another provider, fill your profile fields manually.

---

### Step 3 — Fill In Your Profile

Review and edit the following fields before saving:

| Field | What to enter | Example |
|-------|--------------|---------|
| **Result Language** | Language for the analysis output | English / 中文 / हिन्दी / 日本語 |
| **Education** | Your highest degree and institution | `Master of IT, University of Melbourne` |
| **Visa Status** | Your current visa and work rights | `Subclass 485, full work rights` |
| **Target Role** | The type of job you are looking for | `Software Engineer, Data Analyst` |
| **Core Skills** | Key technical skills, comma-separated | `Python, SQL, React, AWS` |
| **Years of Experience** | Your experience level | `1–2 years` or `Graduate` |
| **Work & Project History** | Brief summary of past roles and notable projects (max 400 chars sent to LLM) | `1 yr ML Engineer at Acme. Built LLM-based code reviewer for final year project.` |

Click **Save Profile** when done. The extension validates your API key (if it is new) and then saves everything locally on your device.

---

### Step 4 — Choose Auto or Manual Mode

At the bottom of the popup, toggle the analysis mode:

| Mode | Behaviour |
|------|-----------|
| **Auto** | Automatically analyses every job page you open — no clicks needed |
| **Manual** | A green "Analyze this job" button appears; you decide when to trigger analysis |

> **Tip:** Use Manual mode if you want to control API usage. Auto mode is best when you are doing a bulk job search session.

---

## Using the Extension

### Automatic analysis (Auto mode)

1. Open any supported job listing (e.g. a Seek or LinkedIn job page)
2. The result card appears automatically within a few seconds
3. Read the analysis, then move on to the next listing

### Manual analysis (Manual mode)

1. Open a job listing
2. Click the green **"Analyze this job"** button (top-right corner of the page)
3. Wait for the card to appear — a live timer shows elapsed seconds
4. If the analysis takes longer than 15 seconds, a "Taking longer than usual" message appears

### Reading the result card

```
┌─────────────────────────────────────┐
│ ████  AutoScout AI          [close] │  ← Status colour bar (green/orange/red)
│ Research Analyst – Early Careers    │  ← Job title
├─────────────────────────────────────┤
│  ● Strong Match               82    │  ← Verdict + overall score
│  ████████████████░░░░░░░░░░░░       │  ← Animated score bar
│  ┌──────┐ ┌────────┐ ┌──────┐      │
│  │Role  │ │Skills  │ │Exp   │      │  ← Sub-score tiles
│  │  85  │ │  80    │ │  75  │      │
│  └──────┘ └────────┘ └──────┘      │
│  ┌─────────────────────────────┐    │
│  │ VISA  Open to Visa Holders ✓│    │  ← Visa eligibility tile
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ STRENGTHS                   │    │  ← Green box
│  │ • Strong Python and ML fit  │    │
│  │ • Grad-level role matches   │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ CONCERNS                    │    │  ← Red box
│  │ • No Excel experience shown │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Score interpretation:**

| Score | Verdict | Meaning |
|-------|---------|---------|
| 75–100 | Strong Match | Well aligned — worth applying |
| 50–74 | Consider Carefully | Partial fit — review the concerns |
| 0–49 | Not a Good Fit | Significant gaps — consider skipping |

**Visa tile:**

| Colour | Meaning |
|--------|---------|
| Green ✓ | Role is open to your visa type |
| Red ✗ | Role requires PR / Australian Citizen, or security clearance |

> The extension understands full work rights (PR, 485, NZ Citizen, partner visa), limited rights (student visa, WHV), and restricted roles (citizen-only, security clearance required).

### Moving the card

Click and drag the card header to reposition it anywhere on the screen. The position is remembered for that browsing session.

### Closing the card

Click the **×** button in the top-right corner of the card. The "Analyze this job" button reappears so you can re-analyse at any time.

---

## LLM Provider Support

| Provider | Model | Free tier | PDF résumé parsing | Get key |
|----------|-------|-----------|-------------------|---------|
| **Gemini ✦ Recommended** | `gemini-2.5-flash-lite` | ✅ Yes | ✅ Yes | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| OpenAI | `gpt-4o-mini` | ❌ | ❌ | [platform.openai.com](https://platform.openai.com/api-keys) |
| Claude (Anthropic) | `claude-3-5-haiku` | ❌ | ❌ | [console.anthropic.com](https://console.anthropic.com/) |
| DeepSeek | `deepseek-chat` | ❌ | ❌ | [platform.deepseek.com](https://platform.deepseek.com/) |
| Qwen (Alibaba) | `qwen-plus` | ❌ | ❌ | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com/) |
| Kimi (Moonshot) | `moonshot-v1-8k` | ❌ | ❌ | [platform.moonshot.cn](https://platform.moonshot.cn/) |

---

## Frequently Asked Questions

**Q: Is my data safe? Does it get sent anywhere?**  
Your profile and API key are stored **only on your local device** via `chrome.storage.local`. The job description text and your profile are sent to your chosen LLM provider solely to generate the analysis. No data is sent to any other server. No analytics, no tracking.

**Q: Why does it say "Could not extract job description"?**  
Some pages load content dynamically. Try switching to **Manual mode** and clicking the "Analyze this job" button after the page has fully loaded.

**Q: The analysis is slow — is something wrong?**  
A live timer shows how long the analysis is taking. If it exceeds 15 seconds, a notice appears. This is usually caused by the LLM provider being under high load. Try again in a moment, or switch to a different provider.

**Q: My API key shows ✗ Invalid — but I copied it correctly.**  
Double-check that you selected the correct **Provider** in the dropdown. Each provider has a different key format (Gemini starts with `AIza`, OpenAI/DeepSeek start with `sk-`, Claude with `sk-ant-`).

**Q: I updated my profile but the analysis still uses my old information.**  
Click **Save Profile** after editing. Changes are only applied after saving. If the key is unchanged, saving is instant (no re-validation).

**Q: Can I use this on sites other than the supported list?**  
Yes. On any page that looks like a job listing, the "Analyze this job" button appears automatically. You can trigger analysis on any site as long as the job description text is visible on the page.

**Q: Why does the result card not show on Hatch?**  
Hatch opens job listings inside a modal overlay. Clicking the browser toolbar icon causes the modal to close due to focus events. Use the green **"Analyze this job"** button that appears directly on the page instead.

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| Extension icon not appearing in toolbar | Click the puzzle piece icon → pin AutoScout AI |
| Card does not appear on a job page | Refresh the tab after installing or reloading the extension |
| "Extension was reloaded" error on the card | Refresh the job page — the extension service worker restarted |
| API key keeps showing as invalid | Check that the provider dropdown matches your key type |
| Resume upload button is greyed out | Switch provider to Gemini — PDF parsing requires Gemini |
| Analysis never starts in Auto mode | The page may not be detected as a job listing — click the manual button |

---

## Privacy

- Your API key and profile are stored **locally** via `chrome.storage.local` — never uploaded to any server
- Job description text and your profile are sent to your chosen LLM API **only** to generate the match result
- The result is displayed on-page and is not stored or logged anywhere
- No analytics, no crash reporting, no external servers of our own

---

## Tech Stack

- Chrome Extension Manifest V3
- Google Gemini API (`gemini-2.5-flash-lite`) — default provider
- OpenAI-compatible API format (OpenAI / DeepSeek / Qwen / Kimi)
- Anthropic Messages API (Claude)
- Vanilla JS / CSS — zero runtime dependencies, no build step

---

## Feedback & Bug Reports

Found a bug or have a feature request? Open an issue on GitHub:  
**[github.com/EurusNotes/Autoscount_AI/issues](https://github.com/EurusNotes/Autoscount_AI/issues)**

---

## License

MIT
