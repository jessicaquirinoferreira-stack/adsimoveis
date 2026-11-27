module.exports = function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    })
  );
};
