# Discord Bot Technical Setup Guide

> **Status:** Technical Configuration Document  
> **Purpose:** Step-by-step bot configuration for A2R Discord server  
> **Audience:** Server administrators and technical staff

---

## Table of Contents

1. [Bot Overview](#bot-overview)
2. [GitHub Webhook Setup](#github-webhook-setup)
3. [ModMail Configuration](#modmail-configuration)
4. [Carl-bot Reaction Roles](#carl-bot-reaction-roles)
5. [MEE6 Leveling Setup](#mee6-leveling-setup)
6. [DiscordGitHub Integration](#discordgithub-integration)
7. [Custom Bot (Optional)](#custom-bot-optional)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Bot Overview

### Required Bot Permissions

All bots require these base permissions:
- View Channels
- Send Messages
- Embed Links
- Read Message History
- Use External Emojis
- Add Reactions

### Bot Summary Table

| Bot | Invite URL | Difficulty | Maintenance |
|-----|------------|------------|-------------|
| GitHub Webhook | N/A (native) | Easy | None |
| ModMail | modmail.xyz | Medium | Low |
| Carl-bot | carl.gg | Easy | Low |
| MEE6 | mee6.xyz | Easy | Low |
| DiscordGitHub | Native integration | Easy | None |

---

## GitHub Webhook Setup

### Step 1: Create Discord Webhook

1. In Discord, go to **Server Settings** → **Integrations** → **Webhooks**
2. Click **New Webhook**
3. Name: `GitHub Releases`
4. Channel: `#releases`
5. Upload A2R logo as avatar (optional)
6. Copy the **Webhook URL**

### Step 2: Configure GitHub Repository

1. Go to your GitHub repository (e.g., `a2r-platform/a2r`)
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. **Payload URL:** Paste Discord webhook URL
4. **Content type:** `application/json`
5. **Secret:** (Optional) Create a secret for verification
6. **SSL verification:** Enable

### Step 3: Select Events

Choose **Let me select individual events** and check:
- [x] Releases
- [x] Pull requests
- [x] Issues
- [x] Discussions
- [ ] Pushes (optional, can be noisy)

### Step 4: Test Webhook

1. Create a test release in GitHub
2. Verify it appears in #releases
3. Format should be:
   ```
   [REPO_NAME] Release published: v1.0.0
   Title: Version 1.0.0
   Description preview...
   ```

### Advanced: Custom Webhook Formatting

For custom formatting, use a middleware service:

```javascript
// Example: Simple webhook formatter (Node.js/Express)
const express = require('express');
const axios = require('axios');

app.post('/github-webhook', (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;
  
  let discordPayload = {
    username: 'A2R GitHub',
    avatar_url: 'https://github.com/a2r-platform.png',
    embeds: []
  };
  
  if (event === 'release') {
    discordPayload.embeds.push({
      title: `🚀 New Release: ${payload.release.name}`,
      url: payload.release.html_url,
      description: payload.release.body?.substring(0, 400) + '...',
      color: 0x00ff00,
      timestamp: payload.release.published_at,
      footer: {
        text: `Repository: ${payload.repository.full_name}`
      }
    });
  }
  
  // Forward to Discord webhook
  axios.post(process.env.DISCORD_WEBHOOK_URL, discordPayload);
  res.sendStatus(200);
});
```

---

## ModMail Configuration

### Step 1: Invite Bot

1. Go to https://modmail.xyz
2. Click **Add to Discord**
3. Select your A2R server
4. Authorize with required permissions

### Step 2: Initial Setup

In any channel, run:
```
?setup
```

This creates:
- ModMail category
- Log channel
- Notification channel

### Step 3: Configuration

```
?config
```

**Recommended Settings:**

```yaml
# General
prefix: "?"
status: "DM for support"
activity_type: "WATCHING"

# Categories
main_category_id: "CATEGORY_ID_HERE"
log_channel_id: "CHANNEL_ID_HERE"

# Messages
greeting_message: |
  👋 Hi {user}! Welcome to A2R Support.
  
  Please describe your issue and we'll help you shortly.
  
  While you wait:
  • Check docs: https://docs.a2r.dev
  • Browse #plugin-help for common issues

closing_message: |
  ✅ This ticket has been closed.
  
  If you need further assistance, feel free to open a new ticket!

# Permissions
recipient_thread_close: false  # Only mods can close
thread_creation_roles: []      # Anyone can create
blocked_users: []

# Advanced
log_channel: "modmail-logs"
mention_role_id: "MODERATOR_ROLE_ID"
```

### Step 4: Commands Reference

**User Commands:**
| Command | Description |
|---------|-------------|
| `?new <message>` | Create new ticket |
| `?close` | Request ticket close |
| `?anonreply` | Anonymous reply (if enabled) |

**Staff Commands:**
| Command | Description |
|---------|-------------|
| `?reply <message>` | Reply to ticket |
| `?areply <message>` | Anonymous reply |
| `?close [reason]` | Close ticket |
| `?closeall [reason]` | Close all tickets |
| `?block @user` | Block user from tickets |
| `?unblock @user` | Unblock user |
| `?snipe` | View deleted message |

### Step 5: Snippets (Quick Responses)

Create templates for common responses:

```
?snippets add docs Check out our documentation: https://docs.a2r.dev
?snippets add github Report bugs on GitHub: https://github.com/a2r-platform/issues
?snippets add showcase Share your plugin in #showcase channel!
```

Usage:
```
?docs
?github
?showcase
```

---

## Carl-bot Reaction Roles

### Step 1: Invite Bot

1. Go to https://carl.gg
2. Click **Login with Discord**
3. Select your server
4. Authorize permissions

### Step 2: Create Reaction Role Message

In #rules channel, post the role selection message:

```
🎭 **Role Selection**

Click the reactions below to assign yourself roles:

🔔 **@Announcements** - Get notified of important updates
🧪 **@Early Access** - Beta test new features and plugins
💻 **@Plugin Dev Interest** - Show interest in plugin development
🐛 **@Bug Hunter** - Help test and find bugs

**Note:** You can add/remove roles anytime by clicking the reaction again.
```

### Step 3: Configure Reaction Roles

**Method 1: Web Dashboard (Recommended)**

1. Go to https://carl.gg and select your server
2. Navigate to **Reaction Roles** → **Create**
3. Paste the message link (right-click message → Copy Message Link)
4. Configure reactions:

| Emoji | Role | Mode |
|-------|------|------|
| 🔔 | @Announcements | Toggle |
| 🧪 | @Early Access | Toggle |
| 💻 | @Plugin Dev Interest | Toggle |
| 🐛 | @Bug Hunter | Toggle |

5. Set mode to **Toggle** (adds/removes on click)
6. Save

**Method 2: Commands**

```
# Set up reaction role
?reactionrole add MESSAGE_ID 🔔 @Announcements
?reactionrole add MESSAGE_ID 🧪 @Early Access
?reactionrole add MESSAGE_ID 💻 @Plugin Dev Interest
?reactionrole add MESSAGE_ID 🐛 @Bug Hunter

# Set toggle mode
?reactionrole toggle MESSAGE_ID true
```

### Step 4: Verification

1. Test each reaction
2. Verify roles are assigned/removed correctly
3. Check bot has permission to manage roles
4. Ensure Carl-bot's role is above the roles it manages

---

## MEE6 Leveling Setup

### Step 1: Invite Bot

1. Go to https://mee6.xyz
2. Click **Add to Discord**
3. Select your server
4. Authorize permissions

### Step 2: Enable Leveling Plugin

1. Go to MEE6 Dashboard
2. Select your server
3. Go to **Plugins** → **Levels**
4. Enable the plugin

### Step 3: Configure XP Settings

```yaml
# XP Rates
xp_per_message: 15-25
xp_cooldown: 60  # seconds between XP gain

# Level Formula
# MEE6 uses: 5 * (level ^ 2) + 50 * level + 100

# Level Up Channel
level_up_channel: #general-chat

# Level Up Message
level_up_message: |
  🎉 Congratulations {player}! You leveled up to **Level {level}**!
  
  Keep participating to unlock more rewards!
```

### Step 4: Role Rewards

Configure automatic role assignment:

| Level | Role | Action |
|-------|------|--------|
| 5 | @Active Member | Add role |
| 10 | @Regular | Add role |
| 25 | @Contributor (consideration) | Manual review |
| 50 | @Veteran | Add role |

```
# In MEE6 Dashboard → Levels → Role Rewards
```

### Step 5: Leaderboard

Enable and configure:
```
!levels - Show your level
!rank @user - Show user's rank
!leaderboard - Show server leaderboard
```

### Step 6: Disable in Certain Channels

Exclude channels from XP gain:
- #announcements
- #rules
- #bot-commands (if created)

---

## DiscordGitHub Integration

### Step 1: Native GitHub Integration

Discord has built-in GitHub integration:

1. Go to **Server Settings** → **Integrations**
2. Click **GitHub**
3. Click **Authorize**
4. Login to GitHub and authorize
5. Select repositories to connect

### Step 2: Configure Channels

For each channel, configure which events to show:

```
#releases channel:
- ✅ Releases
- ✅ Pull Requests (merged only)
- ❌ Commits

#github-activity channel (optional):
- ✅ Commits
- ✅ Issues
- ✅ Pull Requests
```

### Step 3: Webhook Alternative

If native integration is insufficient, use webhooks:

1. Create webhook in Discord channel
2. In GitHub: Settings → Webhooks → Add webhook
3. Configure as described in GitHub Webhook Setup section

---

## Custom Bot (Optional)

If you need custom functionality, consider building a simple bot:

### Basic Structure (discord.py)

```python
# bot.py
import discord
from discord.ext import commands
import os

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'{bot.user} has connected to Discord!')

@bot.event
async def on_member_join(member):
    # Send welcome DM
    try:
        welcome_msg = """🎉 Welcome to A2R Developer Community!
        
Please read the rules in #rules and grab your roles!

Quick links:
• Docs: https://docs.a2r.dev
• Dev Portal: https://dev.a2r.dev
"""
        await member.send(welcome_msg)
    except:
        pass

@bot.command()
async def docs(ctx):
    """Link to documentation"""
    await ctx.send("📚 Documentation: https://docs.a2r.dev")

@bot.command()
async def portal(ctx):
    """Link to developer portal"""
    await ctx.send("🚀 Developer Portal: https://dev.a2r.dev")

bot.run(os.getenv('DISCORD_TOKEN'))
```

### Environment Setup

```bash
# .env
DISCORD_TOKEN=your_bot_token_here
```

### Hosting Options

| Platform | Cost | Difficulty |
|----------|------|------------|
| Replit | Free | Easy |
| Railway | $5/mo | Easy |
| Heroku | $7/mo | Medium |
| VPS (DigitalOcean) | $5/mo | Medium |

---

## Security Best Practices

### 1. Bot Token Security

```
✅ DO:
• Store tokens in environment variables
• Use .env files (add to .gitignore)
• Rotate tokens if compromised
• Use separate bots for dev/production

❌ DON'T:
• Commit tokens to git
• Share tokens in chat
• Use the same token for multiple instances
```

### 2. Permission Scoping

Grant minimum required permissions:

| Bot | Minimum Permissions |
|-----|-------------------|
| ModMail | 268823632 (Manage Channels, View Audit Log) |
| Carl-bot | 268435462 (Manage Roles, Add Reactions) |
| MEE6 | 67632192 (Manage Messages, Embed Links) |

### 3. Role Hierarchy

```
Server Settings → Roles

Ensure bot roles are:
1. Above roles they need to manage
2. Below Admin/Moderator roles
3. Not given Administrator permission unless necessary
```

### 4. Audit Logging

Enable audit logs for:
- Message deletions
- User kicks/bans
- Role changes
- Channel modifications

```
Server Settings → Audit Log
```

### 5. Rate Limiting

All bots should respect Discord's rate limits:
- 5 requests per 5 seconds per route
- Global rate limit: 50 requests per second

Most bot libraries handle this automatically.

---

## Troubleshooting

### Common Issues

#### Bot Not Responding
```
1. Check bot is online (green dot)
2. Verify bot has View Channel permission
3. Check command prefix is correct
4. Ensure bot role is above required roles
```

#### Reaction Roles Not Working
```
1. Verify Carl-bot has Manage Roles permission
2. Check Carl-bot's role is above assignable roles
3. Ensure message ID is correct
4. Check emoji is valid (not custom from other server)
```

#### ModMail Not Creating Tickets
```
1. Verify ModMail has Manage Channels permission
2. Check category limit (500 channels max)
3. Ensure user isn't blocked
4. Check ModMail status (?status)
```

#### GitHub Webhook Not Firing
```
1. Check webhook URL is correct
2. Verify events are selected in GitHub
3. Check SSL verification settings
4. Test with "Redeliver" in GitHub webhook settings
5. Check Discord webhook channel exists
```

#### MEE6 Not Giving XP
```
1. Check user isn't on cooldown (60s default)
2. Verify channel isn't blacklisted
3. Ensure MEE6 has Send Messages permission
4. Check if user is blocked from bot
```

### Debug Commands

```
# ModMail
?status - Check bot status
?debug - Show debug info

# Carl-bot
?ping - Check bot latency
?diagnostics - Show diagnostic info

# MEE6
!levels - Check level system status
```

### Getting Help

| Bot | Support Server |
|-----|---------------|
| ModMail | https://discord.gg/modmail |
| Carl-bot | https://discord.gg/carlbot |
| MEE6 | https://discord.gg/mee6 |
| Discord API | https://discord.gg/discord-api |

---

## Maintenance Schedule

| Task | Frequency |
|------|-----------|
| Review bot permissions | Monthly |
| Check for bot updates | Monthly |
| Rotate webhook URLs | Quarterly |
| Audit role assignments | Monthly |
| Backup bot configurations | Weekly |
| Review moderation logs | Weekly |

---

## Bot Command Quick Reference

### ModMail
```
?new <message>     - Create ticket
?close [reason]    - Close ticket
?reply <message>   - Reply to user
?block @user       - Block user
?unblock @user     - Unblock user
?snippets          - List snippets
```

### Carl-bot
```
?reactionrole add <msg_id> <emoji> <role>
?reactionrole remove <msg_id> <emoji>
?reactionrole toggle <msg_id> <true/false>
?ping              - Check latency
```

### MEE6
```
!levels            - Your level
!rank [@user]      - User's rank
!leaderboard       - Server leaderboard
!help              - Command list
```

### Native Discord
```
/timeout @user <duration> [reason]
/kick @user [reason]
/ban @user [reason]
/warn @user [reason]
```

---

*Last Updated: 2026-03-07*  
*Document Version: 1.0*
