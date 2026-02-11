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
  // ... (Your onMessage logic remains here)
  const messageData = {
    whatsapp_id: msg.id.id,
    from_number: msg.from,
    body: msg.body,
    is_from_me: false,
  };
  await db.saveMessage(messageData);

  if (msg.body.toLowerCase() === "hi") {
    await messenger.sendMessage(msg.from, "Hello!");
  }

  await llmService.triggerLLMService(messageData, db);
});

app.listen(8080, () => console.log("Service running on port 8080"));
