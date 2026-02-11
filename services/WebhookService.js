const axios = require("axios");
const crypto = require("crypto");

class LLMService {
  // We pass the db repository here to fetch config dynamically
  async triggerLLMService(messageData, db) {
    const config = await db.getActiveWebhook();

    if (!config) {
      console.warn("⚠️ No active webhook configuration found.");
      return;
    }
    const payload = {
      sender_id: messageData.from_number, // maps to sender_id
      content: messageData.body, // maps to content
      timestamp: new Date().toISOString(), // maps to timestamp
      group_id: messageData.from_number.includes("@g.us")
        ? messageData.from_number
        : null, // maps to group_id
    };

    // Advanced: Create a signature using the secret from DB
    const signature = crypto
      .createHmac("sha256", config.secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    let attempts = 0;
    while (attempts < config.retries) {
      try {
        await axios.post(config.url, payload, {
          headers: {
            "X-Hub-Signature-256": `sha256=${signature}`,
            "Content-Type": "application/json",
          },
        });
        console.log(`✅ Webhook sent to ${config.url}`);
        break; // Success! Exit retry loop
      } catch (error) {
        attempts++;
        console.error(
          `❌ Webhook attempt ${attempts} failed: ${error.message}`
        );
        if (attempts >= config.retries) console.error("Final retry failed.");
      }
    }
  }
}

module.exports = new LLMService();
