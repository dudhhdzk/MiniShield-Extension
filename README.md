<p align="center">
    <img src="https://github.com/dudhhdzk/MiniShield-Extension/blob/main/images/logo.png" width="200px" alt="MiniShield-Extension Logo"/>
</p>

<h3 align="center">Comprehensive privacy protection Security and Smart website analysis <b>Disposable Email</b> • <b>Secure Autofill</b> • <b>All-in-One Privacy Suite</b></h3>

<p align="center">
    <b>MiniShield-Extension</b> is a multifunctional browser extension that not only blocks trackers and ads but also provides deep threat analysis using neural networks, integration with antivirus databases, have anonymous mail, autofill, cookie blocker and smart data management and anymore feature.
</p>

<br />

> **Important:** MiniShield-Extension puts your security first. All autofill profile data is stored locally, and integration with external APIs (Gemini, VirusTotal) is fully controlled by you using your own access keys.

---

### 📑 Table of Contents
* [Key Features](#key-features)
* [API Keys Setup](#api-keys-setup)
* [Threat Protection & Analysis](#threat-protection)
* [Smart Cookie Policy](#cookie-policy)
* [Installation](#installation)

---

<a name="key-features"></a>
### 🚀 Key Features

**Autofill Profile**
Save time with a secure local profile. The extension can suggest autofilling forms (First Name, Last Name, Email, Phone, Username, Date of Birth, Organization, Address, Country, City).

**AI Analysis (Gemini API)**
Deep analysis of text content and documents on the page using a built-in neural network. Requires your own API key.

**UI and Notifications**
A visual floating shield button (badge) on pages informs you about the current security status and detected risks. The built-in whitelist includes trusted search engines and services (Google, Bing, Yandex, DuckDuckGo, Yahoo, YouTube).

---

<a name="api-keys-setup"></a>
### 🔑 API Keys Setup (Integrations)

For maximum protection, the extension uses leading security verification services. Basic features work out of the box, but advanced ones require free API keys:

| Service | Purpose | How to get a key |
| :--- | :--- | :--- |
| **Google Safe Browsing** | Phishing and malware protection by Google | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Enable Safe Browsing API) |
| **VirusTotal** | URL checking against 70+ antivirus databases | [virustotal.com/gui/my-apikey](https://www.virustotal.com/gui/my-apikey) (Free key) |
| **Gemini API** | AI analysis of page content | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **PhishTank / URLhaus** | Checking against phishing and malware databases | *Works for free, no key required* |

---

<a name="threat-protection"></a>
### 🛡️ Threat Protection and Deep Analysis

You can select the risk level (All, High+, Critical Only) and configure auto-scan or full operation mode.

* **Anti-tracker:** Block hidden tracking scripts and tracking via social media buttons.
* **Error Collection Blocking:** Stop telemetry from Sentry, Bugsnag, Rollbar, LogRocket, TrackJS, Raygun.
* **Domain Age Analysis (WHOIS):** Automatic warning if a domain was created less than 30 days ago.
* **Form Security:** Block attempts to send your data (logins/passwords) to third-party domains.
* **Anti-Cryptominer:** Detect and block hidden in-browser mining (e.g., Coinhive).
* **Hidden iframe Blocking:** Protection against clickjacking and invisible elements.
* **Obfuscated JS Analysis:** Heuristic analysis for encoded and suspicious scripts (`eval`, `atob`, `fromCharCode`).
* **Redirect Control:** Warnings about suspicious redirect chains.
* **Anti-Installation:** Detect attempts by websites to provoke unwanted installation of other browser extensions.

---

<a name="cookie-policy"></a>
### 🍪 Smart Cookie Policy

The intelligent classification and blocking module divides cookies into categories:

| Category | Description | Default Status |
| :--- | :--- | :--- |
| **Strictly Necessary** | Authorization, shopping cart, basic security | Always allowed |
| **Functional** | Language preferences, theme, UI settings | Customizable |
| **Analytical** | Analytics tools (Google Analytics, Yandex Metrika) | Blocked / Customizable |
| **Advertising** | Targeting, retargeting, ad networks | Strictly blocked |

---

<a name="installation"></a>
### 📦 Installation

*Instructions for loading the extension in developer mode (before publication in stores):*

1. Download the source code of the repository or clone it: `git clone https://github.com/yourusername/MiniShield-Extension.git`
2. Open your browser (Chrome, Edge, or other Chromium-based browser).
3. Navigate to the extensions page: `chrome://extensions/`
4. Enable the **Developer mode** toggle in the top right corner.
5. Click **Load unpacked** and select the folder with the `MiniShield-Extension` source code.
6. Open the extension settings, enter the required API keys, and configure the protection level.
