# Allternit Function Registry v0

> **Version:** 0.1.0
> **Schema:** `spec/FunctionRegistry.v0.json`

---

## Overview

The Function Registry catalogs all executable functions available in the Allternit system. Functions are categorized by domain and tagged with risk levels, platform support, and confirmation requirements.

---

## Risk Levels

| Level | Description | Confirmation Required |
|-------|-------------|-----------------------|
| `low` | Read-only or easily reversible | Optional |
| `medium` | Creates data or minor changes | Recommended |
| `high` | Modifies important data or settings | Required |
| `critical` | Financial transactions, irreversible | Required + MFA |

---

## Function Categories

### 1. System Functions

#### set_alarm
```json
{
  "id": "com.allternit.os.set_alarm",
  "name": "Set Alarm",
  "description": "Sets an alarm on the device",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "low",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "time": { "type": "string", "description": "Time in HH:MM format" },
      "label": { "type": "string", "description": "Alarm label" },
      "repeat": { "type": "array", "items": { "type": "string" }, "description": "Days to repeat" }
    },
    "required": ["time"]
  },
  "examples": [
    { "input": "Set an alarm for 7am", "parameters": { "time": "07:00" } },
    { "input": "Wake me up at 6:30 tomorrow", "parameters": { "time": "06:30", "label": "Wake up" } }
  ]
}
```

#### set_timer
```json
{
  "id": "com.allternit.os.set_timer",
  "name": "Set Timer",
  "description": "Sets a countdown timer",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": false },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "duration_seconds": { "type": "integer", "description": "Duration in seconds" },
      "label": { "type": "string", "description": "Timer label" }
    },
    "required": ["duration_seconds"]
  },
  "examples": [
    { "input": "Set a 5 minute timer", "parameters": { "duration_seconds": 300 } },
    { "input": "Timer for 30 minutes for pasta", "parameters": { "duration_seconds": 1800, "label": "Pasta" } }
  ]
}
```

#### open_app
```json
{
  "id": "com.allternit.os.open_app",
  "name": "Open App",
  "description": "Opens an application",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "app_name": { "type": "string", "description": "Name of the app" },
      "deep_link": { "type": "string", "description": "Optional deep link URL" }
    },
    "required": ["app_name"]
  }
}
```

#### toggle_setting
```json
{
  "id": "com.allternit.os.toggle_setting",
  "name": "Toggle Setting",
  "description": "Toggles a system setting on/off",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "setting": { "type": "string", "enum": ["wifi", "bluetooth", "airplane_mode", "do_not_disturb", "flashlight"] },
      "state": { "type": "boolean", "description": "true=on, false=off" }
    },
    "required": ["setting"]
  }
}
```

#### get_device_info
```json
{
  "id": "com.allternit.os.get_device_info",
  "name": "Get Device Info",
  "description": "Gets device information (battery, storage, etc.)",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "info_type": { "type": "string", "enum": ["battery", "storage", "network", "all"] }
    },
    "required": ["info_type"]
  }
}
```

---

### 2. Communication Functions

#### send_message
```json
{
  "id": "com.allternit.os.send_message",
  "name": "Send Message",
  "description": "Sends a text message to a contact",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": false, "backend": false },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "recipient": { "type": "string", "description": "Phone number or contact name" },
      "message": { "type": "string", "description": "Message content" }
    },
    "required": ["recipient", "message"]
  }
}
```

#### make_call
```json
{
  "id": "com.allternit.os.make_call",
  "name": "Make Call",
  "description": "Initiates a phone call",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": false, "backend": false },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "recipient": { "type": "string", "description": "Phone number or contact name" }
    },
    "required": ["recipient"]
  }
}
```

#### send_email
```json
{
  "id": "com.allternit.os.send_email",
  "name": "Send Email",
  "description": "Composes and sends an email",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "to": { "type": "array", "items": { "type": "string" }, "description": "Recipients" },
      "subject": { "type": "string", "description": "Email subject" },
      "body": { "type": "string", "description": "Email body" },
      "cc": { "type": "array", "items": { "type": "string" } },
      "bcc": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["to", "subject", "body"]
  }
}
```

#### read_notifications
```json
{
  "id": "com.allternit.os.read_notifications",
  "name": "Read Notifications",
  "description": "Reads recent notifications",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "app_filter": { "type": "string", "description": "Filter by app name" },
      "limit": { "type": "integer", "description": "Max notifications to return", "default": 10 }
    }
  }
}
```

---

### 3. Productivity Functions

#### create_note
```json
{
  "id": "com.allternit.os.create_note",
  "name": "Create Note",
  "description": "Creates a new note",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "content": { "type": "string" },
      "folder": { "type": "string" }
    },
    "required": ["content"]
  }
}
```

#### add_reminder
```json
{
  "id": "com.allternit.os.add_reminder",
  "name": "Add Reminder",
  "description": "Adds a reminder with optional due date",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "due_date": { "type": "string", "format": "date-time" },
      "priority": { "type": "string", "enum": ["low", "medium", "high"] },
      "list": { "type": "string", "description": "Reminder list name" }
    },
    "required": ["title"]
  }
}
```

#### schedule_event
```json
{
  "id": "com.allternit.os.schedule_event",
  "name": "Schedule Event",
  "description": "Creates a calendar event",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "start_time": { "type": "string", "format": "date-time" },
      "end_time": { "type": "string", "format": "date-time" },
      "location": { "type": "string" },
      "attendees": { "type": "array", "items": { "type": "string" } },
      "calendar": { "type": "string" }
    },
    "required": ["title", "start_time", "end_time"]
  }
}
```

#### search_notes
```json
{
  "id": "com.allternit.os.search_notes",
  "name": "Search Notes",
  "description": "Searches notes by keyword",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "folder": { "type": "string" },
      "limit": { "type": "integer", "default": 10 }
    },
    "required": ["query"]
  }
}
```

#### start_focus_mode
```json
{
  "id": "com.allternit.os.start_focus_mode",
  "name": "Start Focus Mode",
  "description": "Activates a Focus mode",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "mode": { "type": "string", "enum": ["work", "personal", "sleep", "driving", "fitness"] },
      "duration_minutes": { "type": "integer" }
    },
    "required": ["mode"]
  }
}
```

---

### 4. Navigation Functions

#### get_directions
```json
{
  "id": "com.allternit.os.get_directions",
  "name": "Get Directions",
  "description": "Gets directions to a destination",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "destination": { "type": "string" },
      "origin": { "type": "string", "description": "Optional, defaults to current location" },
      "mode": { "type": "string", "enum": ["driving", "walking", "transit", "cycling"] }
    },
    "required": ["destination"]
  }
}
```

#### share_location
```json
{
  "id": "com.allternit.os.share_location",
  "name": "Share Location",
  "description": "Shares current location with a contact",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": false, "backend": false },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "recipient": { "type": "string" },
      "duration_minutes": { "type": "integer", "description": "How long to share" }
    },
    "required": ["recipient"]
  }
}
```

---

### 5. Media Functions

#### play_music
```json
{
  "id": "com.allternit.os.play_music",
  "name": "Play Music",
  "description": "Plays music by artist, song, or playlist",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Artist, song, album, or playlist" },
      "shuffle": { "type": "boolean", "default": false }
    },
    "required": ["query"]
  }
}
```

#### control_playback
```json
{
  "id": "com.allternit.os.control_playback",
  "name": "Control Playback",
  "description": "Controls media playback",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": true, "backend": false },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "action": { "type": "string", "enum": ["play", "pause", "next", "previous", "volume_up", "volume_down"] },
      "value": { "type": "number", "description": "For volume, 0-100" }
    },
    "required": ["action"]
  }
}
```

#### take_photo
```json
{
  "id": "com.allternit.os.take_photo",
  "name": "Take Photo",
  "description": "Captures a photo",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": false, "desktop": false, "backend": false },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "camera": { "type": "string", "enum": ["front", "back"], "default": "back" },
      "flash": { "type": "string", "enum": ["auto", "on", "off"], "default": "auto" }
    }
  }
}
```

---

### 6. Web/Information Functions

#### web_search
```json
{
  "id": "com.allternit.web.search",
  "name": "Web Search",
  "description": "Performs a web search",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "max_results": { "type": "integer", "default": 5 }
    },
    "required": ["query"]
  }
}
```

#### check_weather
```json
{
  "id": "com.allternit.web.check_weather",
  "name": "Check Weather",
  "description": "Gets weather information",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "location": { "type": "string", "description": "City or 'current'" },
      "days": { "type": "integer", "default": 1 }
    }
  }
}
```

---

### 7. Finance Functions

#### transfer_money
```json
{
  "id": "com.allternit.finance.transfer_money",
  "name": "Transfer Money",
  "description": "Transfers money to another account",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "critical",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "recipient": { "type": "string" },
      "amount": { "type": "number" },
      "currency": { "type": "string", "default": "USD" },
      "note": { "type": "string" }
    },
    "required": ["recipient", "amount"]
  }
}
```

#### check_balance
```json
{
  "id": "com.allternit.finance.check_balance",
  "name": "Check Balance",
  "description": "Checks account balance",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "medium",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "account": { "type": "string", "description": "Account name or ID" }
    }
  }
}
```

#### add_expense
```json
{
  "id": "com.allternit.finance.add_expense",
  "name": "Add Expense",
  "description": "Records an expense",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "amount": { "type": "number" },
      "category": { "type": "string" },
      "description": { "type": "string" },
      "date": { "type": "string", "format": "date" }
    },
    "required": ["amount", "category"]
  }
}
```

---

### 8. Smart Home Functions

#### control_device
```json
{
  "id": "com.allternit.home.control_device",
  "name": "Control Smart Device",
  "description": "Controls a smart home device",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "medium",
  "requires_confirmation": true,
  "parameters": {
    "type": "object",
    "properties": {
      "device": { "type": "string" },
      "action": { "type": "string", "enum": ["on", "off", "toggle", "set"] },
      "value": { "type": "number", "description": "For dimmers, thermostats, etc." }
    },
    "required": ["device", "action"]
  }
}
```

#### get_device_status
```json
{
  "id": "com.allternit.home.get_device_status",
  "name": "Get Device Status",
  "description": "Gets status of a smart home device",
  "version": "1.0.0",
  "platform_support": { "ios": true, "android": true, "web": true, "desktop": true, "backend": true },
  "risk_level": "low",
  "requires_confirmation": false,
  "parameters": {
    "type": "object",
    "properties": {
      "device": { "type": "string" },
      "room": { "type": "string", "description": "Filter by room" }
    }
  }
}
```

---

## Summary

| Category | Functions | Count |
|----------|-----------|-------|
| System | set_alarm, set_timer, open_app, toggle_setting, get_device_info | 5 |
| Communication | send_message, make_call, send_email, read_notifications | 4 |
| Productivity | create_note, add_reminder, schedule_event, search_notes, start_focus_mode | 5 |
| Navigation | get_directions, share_location | 2 |
| Media | play_music, control_playback, take_photo | 3 |
| Web/Info | web_search, check_weather | 2 |
| Finance | transfer_money, check_balance, add_expense | 3 |
| Smart Home | control_device, get_device_status | 2 |
| **Total** | | **26** |
