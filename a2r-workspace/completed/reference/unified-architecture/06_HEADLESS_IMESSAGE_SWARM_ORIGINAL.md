# Project: "Headless iMessage Swarm" Architecture

> **Original Concept Document**
> This document outlines the architecture for a "No-App" agent platform where users communicate with AI Agents via native iMessage (Blue Bubbles), hosted on a central "Hive" infrastructure.

---

## 1. Core Concept

The goal is to provide users with an AI Agent without requiring them to install an app or host a server.

* **User Experience:** User saves a contact (e.g., `agent@a2rchitech.net`) and texts it.
* **Infrastructure:** A centralized cluster of Macs ("The Hive") acts as the gateway.
* **Routing:** A single iCloud identity can serve multiple users by tracking the `Sender ID` (User's Phone Number) to maintain distinct conversation states.

---

## 2. Architecture Components

### A. The Hive (Gateway Layer)
* **Hardware:** Dedicated Mac Mini(s).
* **Software:** `gateway-imessage` (Rust Service).
* **Role:**
    1. **Listen:** Monitors the local `chat.db` or uses AppleScript handlers to detect incoming iMessages.
    2. **Act:** Executes AppleScript to send outbound replies.
    3. **Bridge:** Forwards raw message text + Sender ID to the Orchestrator via internal API/NATS.

### B. The Orchestrator (Kernel Layer)
* **Software:** `runtime-core` (Rust).
* **Role:**
    1. **Session Management:** Maps `Sender ID (+1555...)` to a specific `User Session`.
    2. **Context Loading:** Retrieves the user's conversation history and active "Skill" state.
    3. **Inference:** Calls the LLM (Cloud or Local to the Server) to generate a response.
    4. **Routing:** Sends the response back to The Hive to be delivered.

### C. The Identity Pool
To avoid rate limits and provide segmentation, we use a pool of iCloud accounts.
* `agent.alpha@...` (General Support)
* `agent.beta@...` (Task Management)
* Users are assigned a specific "Access Point" email upon registration.

---

## 3. The "Virtual Contact" Workflow

1. **Registration:** User signs up on web, provides phone number `+19998887777`.
2. **Assignment:** System assigns `agent.01@icloud.com` to this user.
3. **Initiation:** System sends an initial iMessage to `+19998887777` from `agent.01`: *"Hi, I'm your A2rchitech Agent. Save this contact and text me anytime."*
4. **Interaction:**
    * User texts: "Remind me to buy milk."
    * **Hive** receives msg from `+1999...`.
    * **Orchestrator** logs "Buy milk" to User's DB.
    * **Hive** replies: "Added to your list."

---

## 4. Proof of Concept (POC) Implementation Plan

We will build a "Single-Node Hive" using your current Mac to prove the technology.

### Step 1: `gateway-imessage` (Rust)
* **Input:** Reads from `~/Library/Messages/chat.db` (SQLite) to detect new messages in real-time.
  * *Note: This requires Full Disk Access.*
  * *Alternative:* A polling loop that checks for new rows in `message` table.
* **Output:** Uses `osascript` to send replies.

### Step 2: `agent-logic` (Simple Responder)
* A basic logic loop that receives the text.
* If text starts with `/agent`, it triggers the LLM.
* Sends response back to Gateway.

### Step 3: Test
* Use a secondary device (friend's phone or your own iPhone) to text your Mac's Apple ID email.
* Verify the Mac automatically replies.

---

## 5. Risks & Mitigations

* **Rate Limits:** Apple may flag an account sending thousands of messages.
    * *Mitigation:* Use multiple iCloud accounts (The Pool). Throttle outbound speed.
* **Database Access:** Reading `chat.db` requires permissions.
    * *Mitigation:* Grant "Full Disk Access" to the Terminal/Binary once.
* **Blue Bubble vs Green:**
    * If the user is on Android, this system degrades to SMS (via iCloud SMS forwarding if enabled on the Mac). Ideally, strictly target Apple users for the "Premium" experience.

---

**Next Action:** Initialize the `gateway-imessage` service in the project workspace.
