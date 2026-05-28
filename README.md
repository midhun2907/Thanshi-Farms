# Thanshi Farms - Management Portal

A premium, high-fidelity, responsive Single Page Application (SPA) designed to track, calculate, and log daily wage workers, cocoa sales, general expenses, and permanent staff operations at **Thanshi Farms**.

---

## 🚀 Key Features

* **Module 1: Daily Wage Worker Tracking**
  * Record logs by date (Month, Date, Year format).
  * Separate tracking for Men and Women counts, rates, and totals.
  * Dropdown selection pre-seeded with custom agricultural categories (`Penta`, `Palm oil gellalu`, `Gaddi mandhu`, `Thukku`, `Plowing`, `Harvesting`, `Weeding`).
  * Add custom categories on-the-fly.
  * Mark wage payments as Paid or Unpaid.
  
* **Module 2: Cocoa Sales Portal**
  * Sell records matching Seller name (mandatory, selection from pre-populated dropdown with new addition options) and Seller Contact.
  * Record Buyer name and Contact.
  * Enter quantity in Kilograms and rate per Kilogram (auto-calculates total in INR).
  * Mandatory receipt attachment (auto-compressed in browser under 100KB using Canvas to prevent local storage overflow).
  
* **Module 3: General Expenses**
  * Log farm-related expenses like fertilizer purchases, machinery hiring, or seed procurement.
  
* **Module 4: Financial Year Dashboard**
  * Consolidated counts for Cocoa Revenues, Daily Wages, and General Expenses.
  * Calculates Net Cash Flow (Revenue minus Costs).
  * Dynamic vector SVG bar chart showing categories.
  * Financial years strictly bounded from **June 1st to May 31st** (computes and suggests active financial year automatically based on local time, e.g., May 28, 2026 selects `2025 - 2026` and transitions to `2026 - 2027` on June 1st, 2026).
  * Recent activity lists.
  
* **Module 5: Permanent Staff Directory (Excluded from FY)**
  * Register permanent employees (Name, Start Date, Yearly salary, Mobile).
  * Record absences only (non-daily tracker).
  * Record salary advances and withdrawals. Computes remaining balances automatically based on the Yearly Salary.
  * **Interactive SMS Simulation:** Generates template notification messages (absence alerts and advance receipt logs) displaying them inside an in-app smartphone chat simulator with custom synthetic digital beep chimes (Web Audio API) and outbox logs.
  
* **Data & Backups**
  * Syncs automatically in background using HTML5 `localStorage`.
  * Single-button DB backup downloading full states in JSON.
  * Restore DB files from JSON uploads.
  * Clean CSV reports exporting for wages, cocoa sales, and general expenses (filtered by category).
  * Print-optimized layout design: Pressing **Print PDF** cleanly formats records into tabular reports while automatically hiding sidebars, forms, and triggers.

---

## 🛠️ How to Open and Run

Since the application is built entirely as a static SPA using vanilla HTML5, modern CSS3, and JavaScript, it is **100% compatible to host online** on services like GitHub Pages, Vercel, Netlify, or Firebase Hosting directly without any backend configuration or compilation.

### Running Locally
1. Double-click the `index.html` file in this directory to open it in any modern browser (Chrome, Edge, Firefox, Safari).
2. Alternatively, run a simple local server if you want to preview:
   ```bash
   # Using Python
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your web browser.

### Hosting Online
To host this online:
1. Upload the files (`index.html`, `app.css`, `app.js`) to a public GitHub repository.
2. In the repository settings, go to **Pages**, select the `main` branch, and click Save.
3. Your app will be live on `https://<username>.github.io/<repo-name>/` in less than a minute!
