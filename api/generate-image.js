const { handleGenerateImage, sendJson } = require("../server");

module.exports = async function generateImage(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    await handleGenerateImage(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
};
