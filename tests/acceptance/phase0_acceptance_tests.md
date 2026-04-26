# Acceptance Tests for Phase 0

## Test 1: SMS Gateway Functionality

**Given**: A user sends an SMS to the Allternit number
**When**: The SMS contains a command like "@alarm set 7am"
**Then**: The system should:
- Log the incoming message to the audit log
- Route to the appropriate agent
- Select the appropriate model
- Parse the command as a function call
- Check permissions for the function
- Return a validated function call or appropriate response
- Log the action to the audit trail

**Test Command**:
```bash
curl -X POST http://localhost:3000/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+1234567890",
    "to": "+0987654321",
    "message": "set alarm for 7:30 AM",
    "timestamp": 1697088000,
    "message_id": "msg_12345"
  }'
```

**Expected Response**:
```json
{
  "status": "success",
  "message": null,
  "function_call": {
    "function_id": "com.allternit.os.set_alarm",
    "parameters": {
      "time": "07:30",
      "label": "Wake up"
    }
  }
}
```

## Test 2: Permission Denial

**Given**: A user sends an SMS with a high-risk command
**When**: The command is for a function that is denied for their agent
**Then**: The system should:
- Log the attempt
- Return a denial response
- Not execute the function

**Test Command**:
```bash
curl -X POST http://localhost:3000/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+1234567890",
    "to": "+0987654321",
    "message": "transfer $100 to +0987654321",
    "timestamp": 1697088000,
    "message_id": "msg_12346"
  }'
```

**Expected Response**:
```json
{
  "status": "blocked",
  "message": "This function is not permitted for your agent",
  "function_call": null
}
```

## Test 3: Confirmation Required

**Given**: A user sends an SMS with a high-risk command
**When**: The command is for a function that requires confirmation
**Then**: The system should:
- Log the request
- Return a confirmation required response
- Not execute the function until confirmed

**Test Command**:
```bash
curl -X POST http://localhost:3000/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+1234567890",
    "to": "+0987654321",
    "message": "send message to +1111111111 saying hello",
    "timestamp": 1697088000,
    "message_id": "msg_12347"
  }'
```

**Expected Response**:
```json
{
  "status": "confirmation_required",
  "message": "This action requires explicit confirmation. Please use the app to confirm.",
  "function_call": {
    "function_id": "com.allternit.os.send_message",
    "parameters": {
      "recipient": "+1111111111",
      "message": "hello"
    }
  }
}
```

## Test 4: Agent Routing

**Given**: An incoming message
**When**: The agent router receives a routing request
**Then**: It should return the appropriate agent

**Test Command**:
```bash
curl -X POST http://localhost:3001/route \
  -H "Content-Type: application/json" \
  -d '{
    "message": "set an alarm",
    "user_id": "user123",
    "context": {}
  }'
```

**Expected Response**:
```json
{
  "agent_id": "default_agent",
  "agent_name": "Default Agent",
  "confidence": 1.0
}
```

## Test 5: Model Selection

**Given**: A message and agent ID
**When**: The model router receives a selection request
**Then**: It should return the appropriate model

**Test Command**:
```bash
curl -X POST http://localhost:3002/select \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "default_agent",
    "message": "set alarm for 7:30 AM",
    "context": {}
  }'
```

**Expected Response**:
```json
{
  "model_id": "function_compiler_model",
  "confidence": 0.9
}
```

## Test 6: Permission Check

**Given**: A function call and user context
**When**: The policy service receives a permission check request
**Then**: It should return whether the action is allowed

**Test Command**:
```bash
curl -X POST http://localhost:3003/check \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "default_user",
    "agent_id": "default_agent",
    "function_call": {
      "function_id": "com.allternit.os.set_alarm",
      "parameters": {
        "time": "07:30",
        "label": "Wake up"
      }
    }
  }'
```

**Expected Response**:
```json
{
  "allowed": true,
  "requires_confirmation": true,
  "reason": null
}
```

## Test 7: Audit Logging

**Given**: An event to log
**When**: The audit log service receives a log request
**Then**: It should store the event and return success

**Test Command**:
```bash
curl -X POST http://localhost:3004/log \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "FUNCTION_EXECUTION",
    "user_id": "user123",
    "agent_id": "agent456",
    "action": "com.allternit.os.set_alarm",
    "details": {"time": "07:30", "label": "Wake up"},
    "source": "SMS_GATEWAY"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "event_id": "audit_..."
}
```

## Test 8: Function Registry Query

**Given**: A search query
**When**: The function registry receives a search request
**Then**: It should return matching functions

**Test Command**:
```bash
curl -X POST http://localhost:3005/functions/search \
  -H "Content-Type: application/json" \
  -d '{
    "category": "system",
    "platform": "ios"
  }'
```

**Expected Response**:
```json
[
  {
    "id": "com.allternit.os.set_alarm",
    "name": "Set Alarm",
    "description": "Sets an alarm on the device for a specified time",
    "version": "1.0.0",
    "platform_support": {
      "ios": true,
      "android": true,
      "web": false,
      "desktop": false,
      "backend": false
    },
    "risk_level": "low",
    "requires_confirmation": true,
    "parameters": {...},
    "examples": [...],
    "execution_context": "local",
    "capabilities_required": ["alarms"],
    "timeout_ms": 5000,
    "category": "system"
  }
]
```