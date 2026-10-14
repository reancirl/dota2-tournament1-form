// Vercel serverless function — appends each registration to a Google Sheet.
// Zero dependencies: uses Node's built-in crypto + global fetch (Node 18+).
//
// Env vars required (Vercel → Project → Settings → Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   e.g. bethelhub@my-project.iam.gserviceaccount.com
//   GOOGLE_PRIVATE_KEY             the full private key (keep the \n escapes as-is)
//   GOOGLE_SHEET_ID               the id in the sheet URL: /spreadsheets/d/<THIS>/edit

const crypto = require("crypto");

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsigned = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claim));
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = unsigned + "." + signature;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const json = await resp.json();
  if (!json.access_token) throw new Error("Auth failed: " + JSON.stringify(json));
  return json.access_token;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !sheetId) {
    res.status(500).json({ ok: false, error: "Server not configured (missing env vars)" });
    return;
  }

  try {
    const data = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const row = [
      new Date().toISOString(),       // timestamp
      data.teamName || "",            // team name
      data.captainName || "",         // captain
      data.captainPhone || "",        // contact
      data.agreeFee ? "yes" : "no",   // paid the fee
      data.agreePC ? "yes" : "no",    // agreed to rules
    ];

    const token = await getAccessToken(email, key);

    const url =
      "https://sheets.googleapis.com/v4/spreadsheets/" +
      encodeURIComponent(sheetId) +
      "/values/Sheet1!A:F:append?valueInputOption=USER_ENTERED";

    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error("Sheets append failed (" + resp.status + "): " + text);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("register error:", err.message);
    res.status(500).json({ ok: false, error: "Could not save registration" });
  }
};
