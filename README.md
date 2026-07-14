# LivePerson Blank Conversations Generator Tool

A modern, high-contrast, single-page application built to synthetically generate and manage unauthenticated blank conversations on the LivePerson Conversational Cloud. 

This utility helps brands test routing rules, fallback behaviors, and agent assignment rules for scenarios where a consumer initiates a conversation stream but does not deliver an initial message.

---

## 🎥 Demo Video


https://github.com/user-attachments/assets/1f8b1358-2d5a-4253-8a0c-b6f55f60503c


---

## 🚀 How to Run the Project

Running the generator locally on your machine is quick and simple:

### 1. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
```

### 2. Start the Server
Start the Express server locally:
```bash
npm start
```
The server will boot up and start listening on port `3000`.

### 3. Launch the Dashboard
Open your web browser of choice and navigate to:
```url
http://localhost:3000
```

---

## ✨ Features
- **Unauthenticated Flow**: Create synthetic unauthenticated (guest) consumer sessions seamlessly.
- **Direct Skill Routing**: Optionally specify a Skill ID to test target conversational skill routing.
- **Symmetrical 1:1 Layout**: Fixed-height settings and stream panels with zero layout shifts.
- **Scrolling Terminal Console**: Live websocket handshake debug logs capture stream (toggleable).
- **Theme-Switcher**: Fully responsive layout supporting high-contrast Dark and Light modes.
