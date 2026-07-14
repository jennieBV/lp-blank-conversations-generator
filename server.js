import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CONVERSATIONS_FILE = path.join(__dirname, 'active_conversations.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper to read conversations from file
async function loadConversations() {
  try {
    const data = await fs.readFile(CONVERSATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty list
    return [];
  }
}

// Helper to save conversations to file
async function saveConversations(conversations) {
  try {
    await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write active conversations file:', error);
  }
}

// LivePerson API Helpers

// 1. Resolve Service Domain
async function getLPDomain(accountId, serviceName, logs = []) {
  const url = `https://api.liveperson.net/api/account/${accountId}/service/${serviceName}/baseURI.json?version=1.0`;
  logs.push(`[API REQUEST] Resolve domain baseURI for Service: "${serviceName}"`);
  logs.push(`[INFO] GET ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    logs.push(`[API RESPONSE ERROR] Service Directory query failed. Status: ${response.status} - ${response.statusText}`);
    throw new Error(`Failed to resolve domain for service "${serviceName}": ${response.statusText}`);
  }
  const data = await response.json();
  logs.push(`[API RESPONSE SUCCESS] Service "${serviceName}" baseURI: ${data.baseURI}`);
  return data.baseURI;
}

// 2. Obtain Sentinel AppJWT (using Client ID and Client Secret)
async function getAppJWT(sentinelDomain, accountId, clientId, clientSecret, logs = []) {
  const url = `https://${sentinelDomain}/sentinel/api/account/${accountId}/app/token?v=1.0`;
  logs.push(`[API REQUEST] Obtain AppJWT from Sentinel`);
  logs.push(`[INFO] POST ${url}`);
  logs.push(`[INFO] client_id: "${clientId}"`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    })
  });
  
  if (!response.ok) {
    const text = await response.text();
    logs.push(`[API RESPONSE ERROR] AppJWT retrieval failed. Status: ${response.status} - ${text}`);
    throw new Error(`AppJWT retrieval failed: ${response.status} - ${text}`);
  }
  
  const data = await response.json();
  logs.push(`[INFO] Sentinel response payload keys: ${Object.keys(data).join(', ')}`);
  
  const appJwt = data.access_token || data.token || data.jwt;
  if (!appJwt) {
    logs.push(`[API RESPONSE ERROR] No token key found in Sentinel response.`);
    throw new Error('No AppJWT token found in Sentinel response payload.');
  }
  
  logs.push(`[API RESPONSE SUCCESS] AppJWT successfully retrieved. Token starts with: "${appJwt.slice(0, 15)}..."`);
  return appJwt;
}

// 3. Obtain Anonymous Guest JWS (IDP Signup - Fixed Endpoint Path)
async function getAnonymousGuestJWS(idpDomain, accountId, extConsumerId, logs = []) {
  const url = `https://${idpDomain}/api/account/${accountId}/signup?v=1.0`;
  logs.push(`[API REQUEST] Obtain Anonymous Guest Token via IDP Signup`);
  logs.push(`[INFO] POST ${url}`);
  logs.push(`[INFO] Payload: { "extConsumerId": "${extConsumerId}" }`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ extConsumerId })
  });
  if (!response.ok) {
    const text = await response.text();
    logs.push(`[API RESPONSE ERROR] Anonymous signup failed. Status: ${response.status} - ${text}`);
    throw new Error(`Anonymous signup failed: ${response.status} - ${text}`);
  }
  const data = await response.json();
  const token = data.token || data.jwt;
  logs.push(`[API RESPONSE SUCCESS] Anonymous Guest JWS acquired.`);
  return token;
}

// 4. Create Conversation
async function createLPConversation(messagingDomain, accountId, appJWT, consumerJWS, skillId = null, logs = []) {
  if (!appJWT) {
    // Guest-Only Flow using WebSockets directly (bypasses REST API server-to-server constraints)
    logs.push(`[INFO] Initiating Guest-Only flow using WebSockets directly (no client credentials needed)...`);
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://${messagingDomain}/ws_api/account/${accountId}/messaging/consumer?v=3&jwt=${consumerJWS}`;
      logs.push(`[WS] Connecting to: wss://${messagingDomain}/ws_api/account/${accountId}/messaging/consumer?v=3`);
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `jwt ${consumerJWS}`,
          'X-LP-ON-BEHALF': consumerJWS
        }
      });
      
      let timer = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timeout after 15 seconds"));
      }, 15000);

      ws.on('open', () => {
        logs.push(`[WS] Connection opened. Requesting conversation...`);
        
        const convoBody = {
          brandId: accountId,
          channelType: 'MESSAGING'
        };
        if (skillId) {
          convoBody.skillId = skillId;
        }
        const requestConvo = {
          kind: 'req',
          id: '1',
          type: 'cm.ConsumerRequestConversation',
          body: convoBody
        };
        ws.send(JSON.stringify(requestConvo));
        logs.push(`[WS SENT] ConsumerRequestConversation (reqId: 1)`);
      });

      ws.on('message', (data) => {
        const msgStr = data.toString();
        try {
          const msg = JSON.parse(msgStr);
          if (msg.kind === 'resp') {
            if (msg.reqId === '1') {
              clearTimeout(timer);
              ws.close();
              if (msg.code === 200 && msg.body && msg.body.conversationId) {
                logs.push(`[WS SUCCESS] Conversation successfully created via WebSocket!`);
                resolve(msg.body.conversationId);
              } else {
                logs.push(`[WS ERROR] Failed to create conversation: ${msg.code} - ${JSON.stringify(msg.body)}`);
                reject(new Error(`Failed to request conversation: ${msg.code} - ${JSON.stringify(msg.body)}`));
              }
            }
          }
        } catch (err) {
          logs.push(`[WS WARNING] Non-JSON or error parsing WS message: ${err.message}`);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        logs.push(`[WS ERROR] Socket error occurred: ${err.message}`);
        reject(err);
      });

      ws.on('close', () => {
        logs.push(`[WS] Connection closed.`);
      });
    });
  }

  // Fallback REST flow
  const url = `https://${messagingDomain}/api/account/${accountId}/messaging/consumer/conversation?v=3`;
  
  logs.push(`[API REQUEST] Create Blank Conversation via Messaging Window API [REST Flow]`);
  logs.push(`[INFO] POST ${url}`);
  
  const convoBody = {
    "brandId": accountId
  };
  if (skillId) {
    convoBody.skillId = skillId;
  }

  const payload = [
    {
      "kind": "req",
      "id": "1",
      "type": "userprofile.SetUserProfile",
      "body": {
        "authenticatedData": {
          "lp_sdes": [
            {
              "type": "personal",
              "personal": {
                "firstname": "Messaging Window API",
                "lastname": "blank"
              }
            }
          ]
        }
      }
    },
    {
      "kind": "req",
      "id": "2",
      "type": "cm.ConsumerRequestConversation",
      "body": convoBody
    }
  ];
  logs.push(`[INFO] Payload: ${JSON.stringify(payload)}`);

  const headers = {
    'Content-Type': 'application/json'
  };
  if (appJWT) {
    headers['Authorization'] = `Bearer ${appJWT}`;
    headers['LP-ON-BEHALF'] = consumerJWS;
    headers['X-LP-ON-BEHALF'] = consumerJWS;
    logs.push(`[INFO] Headers set: Authorization (AppJWT) and LP-ON-BEHALF (ConsumerJWS) [Server-to-Server Flow]`);
  } else {
    headers['Authorization'] = `jwt ${consumerJWS}`;
    logs.push(`[INFO] Headers set: Authorization (jwt ConsumerJWS) [Guest-Only Flow]`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    logs.push(`[API RESPONSE ERROR] Conversation creation request failed. Status: ${response.status} - ${text}`);
    throw new Error(`Create Conversation failed: ${response.status} - ${text}`);
  }
  const data = await response.json();
  logs.push(`[API RESPONSE SUCCESS] Response: ${JSON.stringify(data)}`);

  // Parse conversation ID from response array
  let conversationId = null;
  if (Array.isArray(data)) {
    const responseItem = data.find(item => item.kind === 'resp' && item.type === 'cm.ConsumerRequestConversation');
    if (responseItem && responseItem.body && responseItem.body.conversationId) {
      conversationId = responseItem.body.conversationId;
    }
  } else if (data && data.body && data.body.conversationId) {
    conversationId = data.body.conversationId;
  }

  if (!conversationId) {
    // Attempt fallback from entire raw JSON if parsed differently
    const strData = JSON.stringify(data);
    const match = strData.match(/"conversationId":"([^"]+)"/);
    if (match && match[1]) {
      conversationId = match[1];
    }
  }

  if (!conversationId) {
    logs.push(`[API RESPONSE ERROR] Could not extract conversationId from response.`);
    throw new Error('Could not extract conversationId from LivePerson response.');
  }

  return conversationId;
}

// 5. Close Conversation
async function closeLPConversation(messagingDomain, accountId, appJWT, consumerJWS, conversationId, logs = []) {
  if (!appJWT) {
    // Guest-Only Flow using WebSockets to close (bypasses REST API server-to-server constraints)
    logs.push(`[INFO] Initiating Guest-Only close flow using WebSockets directly (no client credentials needed)...`);
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://${messagingDomain}/ws_api/account/${accountId}/messaging/consumer?v=3&jwt=${consumerJWS}`;
      logs.push(`[WS] Connecting to: wss://${messagingDomain}/ws_api/account/${accountId}/messaging/consumer?v=3`);
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `jwt ${consumerJWS}`,
          'X-LP-ON-BEHALF': consumerJWS
        }
      });
      
      let timer = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timeout after 15 seconds"));
      }, 15000);

      ws.on('open', () => {
        logs.push(`[WS] Connection opened. Sending close conversation request...`);
        
        const closeConvo = {
          kind: 'req',
          id: '1',
          type: 'cm.UpdateConversationField',
          body: {
            conversationId: conversationId,
            conversationField: [
              {
                field: "ConversationStateField",
                conversationState: "CLOSE"
              }
            ]
          }
        };
        ws.send(JSON.stringify(closeConvo));
        logs.push(`[WS SENT] UpdateConversationField (CLOSE) (reqId: 1)`);
      });

      ws.on('message', (data) => {
        const msgStr = data.toString();
        try {
          const msg = JSON.parse(msgStr);
          if (msg.kind === 'resp') {
            if (msg.reqId === '1') {
              clearTimeout(timer);
              ws.close();
              if (msg.code === 200) {
                logs.push(`[WS SUCCESS] Conversation successfully closed via WebSocket.`);
                resolve();
              } else {
                logs.push(`[WS ERROR] Failed to close conversation: ${msg.code} - ${JSON.stringify(msg.body)}`);
                reject(new Error(`Failed to close conversation: ${msg.code} - ${JSON.stringify(msg.body)}`));
              }
            }
          }
        } catch (err) {
          logs.push(`[WS WARNING] Non-JSON or error parsing WS message: ${err.message}`);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        logs.push(`[WS ERROR] Socket error occurred: ${err.message}`);
        reject(err);
      });

      ws.on('close', () => {
        logs.push(`[WS] Connection closed.`);
      });
    });
  }

  // Fallback REST flow
  const url = `https://${messagingDomain}/api/account/${accountId}/messaging/consumer/conversation?v=3`;
  logs.push(`[API REQUEST] Close Conversation via Messaging Window API [REST Flow]`);
  logs.push(`[INFO] POST ${url}`);

  const payload = [
    {
      "kind": "req",
      "id": "1",
      "type": "cm.UpdateConversationField",
      "body": {
        "conversationId": conversationId,
        "conversationField": [
          {
            "field": "ConversationStateField",
            "conversationState": "CLOSE"
          }
        ]
      }
    }
  ];
  logs.push(`[INFO] Payload: ${JSON.stringify(payload)}`);

  const headers = {
    'Content-Type': 'application/json'
  };
  if (appJWT) {
    headers['Authorization'] = `Bearer ${appJWT}`;
    headers['LP-ON-BEHALF'] = consumerJWS;
    headers['X-LP-ON-BEHALF'] = consumerJWS;
    logs.push(`[INFO] Headers set: Authorization (AppJWT) and LP-ON-BEHALF (ConsumerJWS) [Server-to-Server Flow]`);
  } else {
    headers['Authorization'] = `jwt ${consumerJWS}`;
    logs.push(`[INFO] Headers set: Authorization (jwt ConsumerJWS) [Guest-Only Flow]`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    logs.push(`[API RESPONSE ERROR] Close conversation request failed. Status: ${response.status} - ${text}`);
    throw new Error(`Close Conversation failed: ${response.status} - ${text}`);
  }
  const data = await response.json();
  logs.push(`[API RESPONSE SUCCESS] Response: ${JSON.stringify(data)}`);
}

// Express API Routes

// Route: Get Active Conversations
app.get('/api/conversations', async (req, res) => {
  const list = await loadConversations();
  res.json(list);
});

// Route: Start Blank Conversations
app.post('/api/generate', async (req, res) => {
  const { accountId, count, skillId, clientId, clientSecret } = req.body;
  const numConversations = parseInt(count) || 1;

  if (!accountId) {
    return res.status(400).json({ success: false, error: 'Account ID (Site ID) is required.' });
  }

  const isServerToServer = !!(clientId && clientSecret);
  const newConvos = [];
  const logs = [];

  try {
    logs.push(`[INFO] Starting bulk generation of ${numConversations} blank conversation(s)...`);
    
    // Resolve required domains
    logs.push(`[INFO] Dynamically retrieving domains from Domain API...`);
    const idpDomain = await getLPDomain(accountId, 'idp', logs);
    const messagingDomain = await getLPDomain(accountId, 'asyncMessagingEnt', logs);
    
    let appJWT = null;
    if (isServerToServer) {
      const sentinelDomain = await getLPDomain(accountId, 'sentinel', logs);
      logs.push(`[SUCCESS] Resolved idp: ${idpDomain}, messaging: ${messagingDomain}, sentinel: ${sentinelDomain}`);
      appJWT = await getAppJWT(sentinelDomain, accountId, clientId, clientSecret, logs);
    } else {
      logs.push(`[SUCCESS] Resolved idp: ${idpDomain}, messaging: ${messagingDomain} (Skipping sentinel domain resolution for Guest-Only Flow)`);
    }

    const currentConversations = await loadConversations();

    for (let i = 0; i < numConversations; i++) {
      const index = i + 1;
      const extConsumerId = `blank_convo_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      logs.push(`[${index}/${numConversations}] Registering consumer ID: ${extConsumerId}`);
      
      try {
        // Register consumer anonymously
        const consumerJWS = await getAnonymousGuestJWS(idpDomain, accountId, extConsumerId, logs);
        logs.push(`[${index}/${numConversations}] Consumer Token received successfully.`);

        // Create blank conversation
        if (skillId) {
          logs.push(`[${index}/${numConversations}] Requesting blank conversation with Direct Skill Routing (Skill: ${skillId})...`);
        } else {
          logs.push(`[${index}/${numConversations}] Requesting blank conversation...`);
        }
        const conversationId = await createLPConversation(messagingDomain, accountId, appJWT, consumerJWS, skillId, logs);
        logs.push(`[${index}/${numConversations}] CONVERSATION STARTED: ${conversationId}`);

        const newConvoItem = {
          conversationId,
          extConsumerId,
          consumerJWS,
          accountId,
          createdAt: new Date().toISOString(),
          status: 'ACTIVE',
          engine: 'WINDOW_API',
          transferred: !!skillId,
          transferredTo: skillId || null
        };

        newConvos.push(newConvoItem);
        currentConversations.push(newConvoItem);
      } catch (err) {
        console.error(`Error on conversation #${index}:`, err);
        logs.push(`[${index}/${numConversations}] [ERROR] Creation failed: ${err.message}`);
      }
    }

    await saveConversations(currentConversations);

    res.json({
      success: true,
      conversations: newConvos,
      logs
    });
  } catch (error) {
    console.error('Generation error:', error);
    logs.push(`[ERROR] Batch generation failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message, logs });
  }
});

// Route: End / Close Conversation
app.post('/api/end-conversation', async (req, res) => {
  const { accountId, conversationId, extConsumerId, clientId, clientSecret } = req.body;

  if (!accountId || !conversationId || !extConsumerId) {
    return res.status(400).json({ success: false, error: 'Missing parameters. Site ID (accountId), conversationId, and extConsumerId are required.' });
  }

  const isServerToServer = !!(clientId && clientSecret);
  const logs = [];

  try {
    logs.push(`[INFO] Initiating closure of conversation: ${conversationId}`);

    // Resolve domains
    const idpDomain = await getLPDomain(accountId, 'idp', logs);
    const messagingDomain = await getLPDomain(accountId, 'asyncMessagingEnt', logs);

    let appJWT = null;
    if (isServerToServer) {
      const sentinelDomain = await getLPDomain(accountId, 'sentinel', logs);
      appJWT = await getAppJWT(sentinelDomain, accountId, clientId, clientSecret, logs);
    } else {
      logs.push(`[INFO] Operating in Guest-Only Flow (Skipping AppJWT resolution)`);
    }

    // Direct unauthenticated closure (dynamic guest signup fallback)
    const conversations = await loadConversations();
    const savedConvo = conversations.find(c => c.conversationId === conversationId);
    
    let consumerJWS = savedConvo ? savedConvo.consumerJWS : null;
    if (!consumerJWS) {
      logs.push(`[INFO] No saved consumerJWS found. Performing fresh IDP signup...`);
      consumerJWS = await getAnonymousGuestJWS(idpDomain, accountId, extConsumerId, logs);
    } else {
      logs.push(`[INFO] Reusing authentic consumerJWS from saved conversation record.`);
    }

    // Close Conversation
    logs.push(`[INFO] Sending cm.UpdateConversationField payload to end the conversation...`);
    await closeLPConversation(messagingDomain, accountId, appJWT, consumerJWS, conversationId, logs);
    logs.push(`[SUCCESS] Conversation ${conversationId} ended.`);

    // Update state in file (mark as CLOSED with timestamp)
    const updatedConversations = conversations.map(c => {
      if (c.conversationId === conversationId) {
        return {
          ...c,
          status: 'CLOSED',
          closedAt: new Date().toISOString()
        };
      }
      return c;
    });
    await saveConversations(updatedConversations);

    res.json({
      success: true,
      message: `Conversation ${conversationId} closed successfully.`,
      logs
    });
  } catch (error) {
    console.error('Close error:', error);
    logs.push(`[ERROR] Close failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message, logs });
  }
});

// Route: Clear Closed History
app.post('/api/clear-history', async (req, res) => {
  try {
    let conversations = await loadConversations();
    conversations = conversations.filter(c => c.status !== 'CLOSED');
    await saveConversations(conversations);
    res.json({ success: true, message: 'History cleared successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
