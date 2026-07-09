const { handleGenerateDeck, sendJson } = require("../server");

module.exports = async function generateDeck(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    await handleGenerateDeck(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
};
