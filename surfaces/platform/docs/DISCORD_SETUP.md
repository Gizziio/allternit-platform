# A2R Developer Community - Discord Server Setup Guide

> **Status:** Planning Document  
> **Purpose:** Comprehensive guide for setting up the A2R Developer Community Discord server  
> **Audience:** Community managers and server administrators

---

## Table of Contents

1. [Overview](#overview)
2. [Server Structure](#server-structure)
3. [Roles Configuration](#roles-configuration)
4. [Bots and Integrations](#bots-and-integrations)
5. [Rules Template](#rules-template)
6. [Onboarding Flow](#onboarding-flow)
7. [Moderation Guidelines](#moderation-guidelines)
8. [Channel Topics](#channel-topics)
9. [Welcome Message Template](#welcome-message-template)
10. [Checklist](#checklist)

---

## Overview

The A2R Developer Community Discord server serves as the central hub for plugin developers, contributors, and users of the A2R platform. This guide provides a complete blueprint for setting up and maintaining a professional, organized, and welcoming community space.

### Server Goals

- Foster a collaborative developer community
- Provide timely support for plugin development
- Share knowledge and best practices
- Showcase community-built plugins
- Gather feedback and feature requests
- Coordinate beta testing and early access programs

---

## Server Structure

### Category: WELCOME

| Channel | Type | Purpose |
|---------|------|---------|
| #announcements | Text | Official announcements, updates, and news |
| #rules | Text | Server rules and guidelines |
| #introductions | Text | New member introductions |

**Permissions:**
- #announcements: @everyone (View only), @Admin/Moderator/Core Team (Send)
- #rules: @everyone (View only), @Admin/Moderator (Manage)
- #introductions: @everyone (Send Messages)

---

### Category: GENERAL

| Channel | Type | Purpose |
|---------|------|---------|
| #general-chat | Text | Casual community discussions |
| #showcase | Text | Plugin showcases and demos |
| #random | Text | Off-topic conversations |

**Permissions:**
- All channels: @everyone (standard permissions)
- Slow mode: 5 seconds on #general-chat, 30 seconds on #showcase

---

### Category: DEVELOPMENT

| Channel | Type | Purpose |
|---------|------|---------|
| #plugin-help | Text | Technical support and help requests |
| #api-discussion | Text | API questions and architecture discussions |
| #feature-requests | Text | Suggestions for platform improvements |
| #bug-reports | Text | Bug reporting and tracking |

**Permissions:**
- Thread creation enabled for all channels
- @Plugin Dev and @Contributor get priority support indicators

---

### Category: RESOURCES

| Channel | Type | Purpose |
|---------|------|---------|
| #templates-share | Text | Share plugin templates and boilerplates |
| #docs-feedback | Text | Documentation feedback and suggestions |
| #releases | Text | Plugin and platform release notifications |

**Permissions:**
- #releases: Webhook-only posting (GitHub integration)
- #templates-share: File attachments enabled (max 25MB)

---

### Voice Channels (Optional)

| Channel | Type | Purpose |
|---------|------|---------|
| General | Voice | Casual voice chat |
| Dev Office Hours | Voice | Scheduled help sessions |
| Plugin Demo | Stage | Plugin showcase events |

---

## Roles Configuration

### Role Hierarchy (Top to Bottom)

```
@Admin
@Moderator
@Core Team
@Plugin Dev
@Contributor
@Early Access
@Member (default)
@Muted
```

### Role Details

#### @Admin
- **Color:** #FF0000 (Red)
- **Permissions:** Administrator
- **Mentionable:** No
- **Display separately:** Yes
- **Description:** Server administrators with full control

#### @Moderator
- **Color:** #00FF00 (Green)
- **Permissions:** Manage Messages, Kick Members, Mute Members, Manage Threads
- **Mentionable:** No
- **Display separately:** Yes
- **Description:** Community moderators enforcing rules

#### @Core Team
- **Color:** #FFD700 (Gold)
- **Permissions:** Mention @here and @everyone in specific channels
- **Mentionable:** Yes
- **Display separately:** Yes
- **Description:** A2R platform core team members

#### @Plugin Dev
- **Color:** #9B59B6 (Purple)
- **Permissions:** Embed links, attach files, use external emojis
- **Mentionable:** Yes
- **Display separately:** Yes
- **Description:** Verified plugin developers
- **Requirements:** Published at least one plugin or significant contribution

#### @Contributor
- **Color:** #3498DB (Blue)
- **Permissions:** Embed links, attach files
- **Mentionable:** No
- **Display separately:** Yes
- **Description:** Active contributors to the platform
- **Requirements:** Regular participation in discussions, bug reports, or PRs

#### @Early Access
- **Color:** #E67E22 (Orange)
- **Permissions:** Access to beta channels
- **Mentionable:** No
- **Display separately:** Yes
- **Description:** Beta testers and early access participants
- **Requirements:** Signed up for beta program

#### @Member (Default)
- **Color:** Default
- **Permissions:** Standard text/voice permissions
- **Mentionable:** No
- **Display separately:** No
- **Description:** Standard community member

#### @Muted
- **Color:** #95A5A6 (Gray)
- **Permissions:** View channels only (no send permissions)
- **Mentionable:** No
- **Display separately:** No
- **Description:** Temporary restriction role

---

## Bots and Integrations

### Required Bots

#### 1. GitHub Webhook
**Purpose:** Automatic release notifications

**Setup:**
1. Go to GitHub repository → Settings → Webhooks
2. Add Discord webhook URL
3. Select events: Releases, Pull requests, Issues
4. Content type: `application/json`

**Configuration:**
```json
{
  "name": "GitHub",
  "avatar": "https://github.com/github.png",
  "channel": "#releases"
}
```

#### 2. ModMail
**Purpose:** Private support ticket system

**Setup:**
1. Invite ModMail bot: https://modmail.xyz
2. Run `?setup` in server
3. Configure categories and permissions
4. Set response templates

**Commands:**
- `?new <message>` - Create new ticket
- `?reply <message>` - Reply to ticket
- `?close` - Close ticket with optional reason
- `?anonreply` - Anonymous staff reply

#### 3. Reaction Roles (Carl-bot or similar)
**Purpose:** Self-assignable roles for opt-in channels

**Setup:**
1. Invite Carl-bot: https://carl.gg
2. Create reaction role message in #rules
3. Configure emoji-to-role mappings

**Role Menu:**
| Emoji | Role | Description |
|-------|------|-------------|
| 🔔 | @Announcements | Get pinged for announcements |
| 🧪 | @Early Access | Beta testing participation |
| 💻 | @Plugin Dev Interest | Interested in plugin development |
| 🐛 | @Bug Hunter | Interested in testing and bug reports |

#### 4. MEE6 (or Leveling Bot)
**Purpose:** Engagement and activity rewards

**Setup:**
1. Invite MEE6: https://mee6.xyz
2. Enable leveling plugin
3. Configure XP rates and rewards

**Level Rewards:**
| Level | Reward |
|-------|--------|
| 5 | Custom role color |
| 10 | Access to #premium-discussions (if created) |
| 25 | "Active Member" badge |
| 50 | @Contributor role consideration |

#### 5. DiscordGitHub
**Purpose:** Sync GitHub activity to Discord

**Setup:**
1. Add GitHub integration in Server Settings → Integrations
2. Connect repository
3. Configure event notifications

---

### Bot Permission Summary

| Bot | Required Permissions |
|-----|---------------------|
| GitHub Webhook | Manage Webhooks, Send Messages |
| ModMail | Manage Channels, Manage Messages, Embed Links |
| Carl-bot | Manage Roles, Add Reactions, Manage Messages |
| MEE6 | Manage Messages, Embed Links, Attach Files |
| DiscordGitHub | Manage Webhooks, Send Messages |

---

## Rules Template

### Server Rules

```
📜 **A2R Developer Community Rules**

1. **Be Respectful**
   Treat everyone with respect. Harassment, discrimination, or toxic behavior will not be tolerated.

2. **No Spam or Self-Promotion**
   • No unsolicited DM advertisements
   • No excessive emoji/meme spam
   • Promote your plugin only in #showcase

3. **Plugin Showcases in #showcase Only**
   Share your plugins, demos, and projects in the designated channel. Include descriptions and links.

4. **Use Threads for Support**
   Keep #plugin-help organized by creating threads for individual issues. This helps others find solutions.

5. **Keep On-Topic**
   • #plugin-help → Technical questions only
   • #api-discussion → API-related discussions
   • #random → Everything else

6. **Follow Discord ToS**
   All Discord Terms of Service and Community Guidelines apply.

7. **No Piracy or Illegal Content**
   Sharing cracked software, copyrighted material, or illegal content is prohibited.

8. **English Only**
   Please keep conversations in English so moderators can assist everyone.

**Enforcement:**
• 1st offense: Warning
• 2nd offense: Mute (1-24 hours)
• 3rd offense: Kick
• Severe violations: Immediate ban

**Report Issues:**
DM @ModMail or ping @Moderator for urgent issues.
```

---

## Onboarding Flow

### Step 1: Welcome Message
Upon joining, members receive a DM from a bot (MEE6 or custom):

```
🎉 Welcome to the A2R Developer Community!

We're excited to have you here. Here's how to get started:

1️⃣ **Read the Rules**
   Check out #rules to understand our community guidelines.

2️⃣ **Choose Your Roles**
   Go to #rules and click the reactions to get relevant roles:
   🔔 Announcements - Stay updated
   🧪 Early Access - Beta test new features
   💻 Plugin Dev - Show you're a developer
   🐛 Bug Hunter - Help us squash bugs

3️⃣ **Introduce Yourself**
   Tell us about yourself in #introductions!

4️⃣ **Get Help**
   Need assistance? Check #plugin-help or use ModMail.

🔗 **Quick Links**
• Documentation: https://docs.a2r.dev
• Developer Portal: https://dev.a2r.dev
• GitHub: https://github.com/a2r-platform

Enjoy your stay! 🚀
```

### Step 2: Rules Acknowledgment
- Reaction role in #rules required to unlock full server access
- Must agree to rules before posting in most channels

### Step 3: Introduction Prompt
- After 10 minutes, bot reminds to post in #introductions
- Template provided:
  ```
  **Name/Nickname:** 
  **Experience:** 
  **Interested in:** 
  **Current Project:** (optional)
  ```

### Step 4: First Steps Guide
Pinned message in #general-chat:

```
🌟 **New to A2R? Start Here!**

**For Plugin Users:**
→ Browse #showcase for cool plugins
→ Check #releases for updates
→ Ask questions in #plugin-help

**For Developers:**
→ Read the docs: https://docs.a2r.dev
→ Share templates in #templates-share
→ Discuss APIs in #api-discussion
→ Request features in #feature-requests

**Get Involved:**
💡 Have an idea? Post in #feature-requests
🐛 Found a bug? Report in #bug-reports
📢 Want to showcase? Post in #showcase
```

---

## Moderation Guidelines

### Warning System

**Strike Tracking:**
- Use Moderation bot or manual tracking
- Keep record in private mod channel
- Include: User, Date, Reason, Evidence

**Warning Levels:**
| Level | Action | Duration |
|-------|--------|----------|
| Warning 1 | Verbal warning | - |
| Warning 2 | Mute | 1 hour |
| Warning 3 | Mute | 24 hours |
| Warning 4 | Kick | - |
| Warning 5 | Ban | Permanent |

### Mute/Kick/Ban Thresholds

**Immediate Mute (1-24h):**
- Spam (5+ messages in 10 seconds)
- Excessive caps (70%+ in 3+ messages)
- Mild toxicity

**Immediate Kick:**
- Repeated rule violations after warnings
- Trolling
- Unsolicited DM advertising

**Immediate Ban:**
- Hate speech or discrimination
- Doxxing or threats
- NSFW content
- Malware/links to malicious sites
- Ban evasion

### Appeal Process

**Ban Appeal:**
1. Appeals handled via ModMail or email
2. Must wait minimum 7 days before appealing
3. Appeal format:
   ```
   **Discord Username:**
   **Ban Date:**
   **Ban Reason:**
   **Why should we unban you:**
   **How will you follow rules in the future:**
   ```
4. Admin team reviews within 48 hours
5. Decision is final

**Mute Appeal:**
- Can appeal mutes over 12 hours
- Contact any @Moderator
- Explain situation and provide context

### Moderation Commands Reference

**Using Discord Native:**
- Timeout: `/timeout @user <duration> [reason]`
- Kick: `/kick @user [reason]`
- Ban: `/ban @user [reason]`

**Using Bot (if configured):**
- `?warn @user <reason>`
- `?mute @user <duration> <reason>`
- `?unmute @user`
- `?kick @user <reason>`
- `?ban @user <reason>`

### Private Moderation Channel

Create #mod-log (Admin/Moderator only):
- Log all warnings, mutes, kicks, bans
- Include timestamps and evidence
- Discuss sensitive moderation issues

---

## Channel Topics

### WELCOME Category

**#announcements**
```
📢 Official A2R announcements, updates, and important news.
🔕 @everyone mentions are rare and important!
```

**#rules**
```
📜 Please read and follow our community rules.
React with ✅ to agree and unlock the server!
```

**#introductions**
```
👋 Welcome! Tell us about yourself, your experience, and what you're building with A2R.
Check pinned message for template!
```

### GENERAL Category

**#general-chat**
```
💬 General community discussions. Be friendly, stay respectful!
🚫 Support questions → #plugin-help
```

**#showcase**
```
🎨 Share your plugins, projects, and demos!
Include: Name, Description, Link, Screenshots
```

**#random**
```
🎯 Off-topic conversations. Memes welcome, keep it friendly!
```

### DEVELOPMENT Category

**#plugin-help**
```
🆘 Get help with plugin development and usage.
💡 Use threads for individual questions!
```

**#api-discussion**
```
🔌 Discuss A2R APIs, architecture, and best practices.
Perfect for deep technical conversations.
```

**#feature-requests**
```
💭 Suggest new features and improvements for the A2R platform.
Vote with 👍 and 👎 reactions!
```

**#bug-reports**
```
🐛 Report bugs and issues.
Template: Description, Steps to Reproduce, Expected vs Actual, Environment
```

### RESOURCES Category

**#templates-share**
```
📋 Share plugin templates, boilerplates, and starter code.
Include: Description, Usage instructions, License
```

**#docs-feedback**
```
📝 Feedback on documentation. Report errors, suggest improvements, ask for clarifications.
```

**#releases**
```
🚀 Automated release notifications from GitHub.
Subscribe to @Announcements role for pings!
```

---

## Welcome Message Template

### Auto-DM on Join

```
═══════════════════════════════════════
   🎉 Welcome to A2R Developer Community!
═══════════════════════════════════════

Hey {user.mention}! We're thrilled to have you join our community of developers building amazing plugins with A2R.

┌─────────────────────────────────────┐
│  📋 QUICK START CHECKLIST           │
├─────────────────────────────────────┤
│  ☐ Read #rules                      │
│  ☐ Pick roles in #rules             │
│  ☐ Introduce yourself               │
│  ☐ Explore channels                 │
└─────────────────────────────────────┘

🔗 IMPORTANT LINKS
   • Docs: https://docs.a2r.dev
   • Dev Portal: https://dev.a2r.dev
   • GitHub: https://github.com/a2r-platform

💬 NEED HELP?
   • General questions: #general-chat
   • Technical support: #plugin-help
   • Private help: DM @ModMail

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enjoy building with A2R! 🚀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Welcome Channel Message

Pin this in #general-chat or use a dedicated #welcome channel:

```
🌟 **Welcome to A2R Developer Community!** 🌟

This is the official Discord server for developers building on the A2R platform. Whether you're creating plugins, exploring the API, or just getting started, you're in the right place!

📚 **Getting Started**
1. Read the rules in #rules
2. Grab your roles below this message
3. Say hi in #introductions

🏗️ **For Developers**
• Share plugins in #showcase
• Get help in #plugin-help  
• Discuss APIs in #api-discussion
• Find templates in #templates-share

📢 **Stay Updated**
• Watch #announcements for news
• Check #releases for updates
• Get the @Announcements role for pings

💝 **Community Values**
We believe in open collaboration, respectful discourse, and helping each other build amazing things.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Quick Reaction Roles** (Click to assign)
🔔 @Announcements • 🧪 @Early Access • 💻 @Plugin Dev Interest • 🐛 @Bug Hunter
```

---

## Checklist

### Pre-Launch Setup

- [ ] Create server with appropriate name and icon
- [ ] Configure server settings (verification level, content filter)
- [ ] Create all categories and channels
- [ ] Set channel permissions and slow mode
- [ ] Create all roles with colors and permissions
- [ ] Configure role hierarchy
- [ ] Invite and set up all bots
- [ ] Configure bot permissions and commands
- [ ] Set up GitHub webhooks
- [ ] Write and pin rules message
- [ ] Create reaction role message
- [ ] Write welcome DM template
- [ ] Create moderation guidelines document
- [ ] Set up private mod channels
- [ ] Test all bot functionality
- [ ] Create invite link (never expires, no limit)

### Post-Launch

- [ ] Announce server launch
- [ ] Monitor first 24 hours closely
- [ ] Collect feedback from early members
- [ ] Adjust roles/channels as needed
- [ ] Document any custom changes

---

## Quick Reference

| Task | Command/Action |
|------|---------------|
| Create ticket | DM ModMail or `?new <message>` |
| Get help | Ping @Moderator or use #plugin-help |
| Assign roles | React in #rules |
| Report user | Right-click → Report, or DM ModMail |
| Showcase plugin | Post in #showcase with description |

---

*Last Updated: 2026-03-07*  
*Document Version: 1.0*  
*Next Review: 2026-06-07*
