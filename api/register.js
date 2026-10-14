// Vercel serverless function — appends each registration to a Google Sheet.
// Env vars required (set in Vercel → Project → Settings → Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   e.g. bethelhub@my-project.iam.gserviceaccount.com
//   GOOGLE_PRIVATE_KEY             the full private key (keep the \n escapes as-is)
//   GOOGLE_SHEET_ID               the id in the sheet URL: /spreadsheets/d/<THIS>/edit

const { google } = require("googleapis");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const data = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const row = [
      new Date().toISOString(),          // timestamp
      data.teamName || "",               // team name
      data.captainName || "",            // captain
      data.captainPhone || "",           // contact
      data.agreeFee ? "yes" : "no",      // paid the fee
      data.agreePC ? "yes" : "no",       // agreed to rules
    ];

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:F",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("register error:", err.message);
    res.status(500).json({ ok: false, error: "Could not save registration" });
  }
};
