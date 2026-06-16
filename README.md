# BigQuery Release Notes Explorer 🪐

A premium, interactive web application that fetches, parses, and formats the official Google Cloud BigQuery release notes Atom feed into a modern, responsive, and gorgeous dashboard. 

Built using **Python Flask** for the backend, and **plain vanilla HTML, CSS, and JavaScript** for the user interface.

---

## 💎 Features

* 🚀 **Smart Caching System**: Release notes are cached in-memory for 10 minutes to ensure fast page loads, with graceful fallback to stale cache if the Google feed server is temporarily offline.
* 🎭 **Vibrant Design System**:
  * Dark-mode aesthetics using soft deep blues, rich indigo highlights, and glowing HSL background orbs.
  * Staggered card entry animations and sleek card border glow highlights on hover.
  * Clear categorization badges powered by [Lucide Icons](https://lucide.dev/).
* 🎛️ **Advanced Client-Side Filtering**:
  * Category-based pills to instantly filter by **Features**, **Changes**, and **Fixes**.
  * Real-time debounced search bar to search dates, update titles, categories, or specific text contents.
* ⏱️ **Relative Time Stamps**: Date nodes are automatically converted to user-friendly relative terms (e.g. *Just now*, *3h ago*, *Yesterday*, *2 weeks ago*).
* 🐤 **Smart Twitter Integration**:
  * Click the "Tweet" button on any release block to instantly compose a tweet.
  * **Highlight Selection**: Highlight a specific sentence or section of text inside a release block and click "Tweet" to share *only* that selected text, automatically formatted to fit within Twitter limits.
* 💀 **Skeleton Screen Loading**: Sleek animated skeleton cards are displayed during loading states to prevent layout shifts.

---

## 📁 File Structure

* `app.py` — Flask server, Atom feed fetcher & parser, caching logic, and API routes.
* `requirements.txt` — Python package dependencies (`flask`, `requests`).
* `templates/index.html` — Layout and structure of the dashboard.
* `static/css/style.css` — Custom design system, layouts, skeletons, and animation keyframes.
* `static/js/main.js` — Client logic for fetch queries, filtering, text selection checking, and tweet composer hooks.
* `.gitignore` — Standard ignore patterns for python cache, environments, and local IDE configs.

---

## 🛠️ Getting Started

### Prerequisites
Make sure you have Python 3 installed on your machine.

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/durgaprasad-86/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:
   ```bash
   python app.py
   ```

4. Open your browser and navigate to:
   👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**
