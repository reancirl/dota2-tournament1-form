// Bethel Hub — Dota 2 Tournament registration server
// No dependencies. Run:  node server.js
// Serves the form and appends every submission to registrations.csv
//
// Monitor submissions live with:   tail -f registrations.csv

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const DIR = __dirname;
const DATA_FILE = path.join(DIR, "registrations.csv");

const COLUMNS = ["timestamp", "teamName", "captainName", "captainPhone", "paidFee", "agreeRules"];

// Create the CSV with a header row the first time.
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, COLUMNS.join(",") + "\n");
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const MIME = { ".html": "text/html", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

const server = http.createServer((req, res) => {
  // ---- Handle a registration submission ----
  if (req.method === "POST" && req.url === "/register") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // basic guard
    });
    req.on("end", () => {
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch { /* ignore */ }

      const row = {
        timestamp: new Date().toISOString(),
        teamName: data.teamName || "",
        captainName: data.captainName || "",
        captainPhone: data.captainPhone || "",
        paidFee: data.agreeFee ? "yes" : "no",
        agreeRules: data.agreePC ? "yes" : "no",
      };

      fs.appendFile(DATA_FILE, COLUMNS.map((c) => csvCell(row[c])).join(",") + "\n", (err) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false }));
          return;
        }
        console.log(`[${row.timestamp}] Registered: ${row.teamName} (${row.captainName})`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // ---- Serve static files ----
  let file = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const full = path.join(DIR, path.normalize(file));
  if (!full.startsWith(DIR)) { res.writeHead(403); res.end("Forbidden"); return; }

  fs.readFile(full, (err, content) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Bethel Hub registration form running:`);
  console.log(`  →  http://localhost:${PORT}\n`);
  console.log(`  Submissions are saved to: registrations.csv`);
  console.log(`  Watch them live with:     tail -f registrations.csv\n`);
});
