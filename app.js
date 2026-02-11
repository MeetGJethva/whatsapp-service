// app.js
const express = require("express");
const morgan = require("morgan");
const logger = require("./middleware/logger");
const bodyParser = require("body-parser");

const MessagingProvider = require("./providers/WebJSProvider");
const MessageRepository = require("./repositories/PostgresRepository");
const llmService = require("./services/WebhookService");

// Controllers
const MessageController = require("./controllers/MessageController");
const WebhookController = require("./controllers/WebhookController");
const messageRoutes = require("./routes/messageRoutes");
const axios = require("axios");
const config = require("./config");

const messenger = new MessagingProvider();
const db = new MessageRepository();

// Initialize Controllers
const messageCtrl = new MessageController(messenger, db);
const webhookCtrl = new WebhookController(db);

const app = express();

// app.use(morgan("dev"));
app.use(logger);

app.use(bodyParser.json());

// --- ROUTES ---
app.use("/", messageRoutes(messageCtrl, webhookCtrl));

// --- EVENT LISTENERS ---

messenger.onMessage(async (msg) => {
  try {
    // 1. Clean the incoming number (e.g., "917229091491@c.us" -> "7229091491")
    // Note: You might need to adjust the slice/regex depending on your region's country code length
    const rawNumber = msg.from.split("@")[0];
    const mobileNumber =
      rawNumber.length > 10 ? rawNumber.slice(-10) : rawNumber;

    // 2. Map phone number to user using the filter payload
    const adminResponse = await axios.post(
      `${config.hosts.backend}/v1/admin-service/poc-details/list`,
      {
        filter: [
          {
            field: "mobile_number",
            operator: "equals",
            value: mobileNumber,
          },
        ],
      }
    );

    const pocs = adminResponse.data?.data?.pocs;
    if (!pocs || pocs.length === 0) {
      console.warn(`No POC found for number: ${mobileNumber}`);
      return; // Exit if user is not registered
    }

    const userId = pocs[0].id;
    let conversation;

    // 3. Check for existing conversation (Agent Host)
    // Note: Using the Query params defined in your Python @router.get("/conversations")
    const convListResponse = await axios.get(
      `${config.hosts.agent}/api/conversations`,
      {
        params: { user_id: userId, limit: 1 },
      }
    );

    const existingConversations = convListResponse.data.data;

    if (existingConversations && existingConversations.length > 0) {
      conversation = existingConversations[0];
    } else {
      // 4. Create conversation if it doesn't exist
      // Matches your Python ConversationCreate schema
      const createResponse = await axios.post(
        `${config.hosts.agent}/api/conversations`,
        {
          user_id: parseInt(userId),
          agent: "database",
          title: "Test",
          // Add title or other fields if required by your model
        }
      );
      conversation = createResponse.data?.data;
    }

    // 5. Save message and trigger services
    const messageData = {
      whatsapp_id: msg.id.id,
      from_number: msg.from,
      body: msg.body,
      is_from_me: false,
      conversation_id: conversation.id, // Now linked to the conversation
      user_id: userId,
    };

    id = await db.saveMessage(messageData);
    // console.log(`id = ${id}`);

    if (msg.body.toLowerCase() === "hi") {
      await messenger.sendMessage(
        msg.from,
        `Hello ${pocs[0].name || "there"}!`
      );
    }

    await llmService.triggerLLMService(id, db);
  } catch (error) {
    console.error("Workflow Error:", error.response?.data || error.message);
  }
});

app.listen(8080, () => console.log("Service running on port 8080"));
