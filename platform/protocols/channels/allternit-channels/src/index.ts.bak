import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';
import { WebClient as SlackClient } from '@slack/web-api';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';

export interface ChannelMessage {
  id: string;
  sender: string;
  content: string;
  channel: string;
}

export class ChannelManager {
  private discord: DiscordClient | null = null;
  private slack: SlackClient | null = null;

  async initDiscord(token: string) {
    this.discord = new DiscordClient({ intents: [GatewayIntentBits.GuildMessages] });
    await this.discord.login(token);
  }

  async initSlack(token: string) {
    this.slack = new SlackClient(token);
  }

  async sendDiscord(channelId: string, text: string) {
    const channel = await this.discord?.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      await channel.send(text);
    }
  }

  async sendSlack(channelId: string, text: string) {
    await this.slack?.chat.postMessage({ channel: channelId, text });
  }

  async initWhatsApp(authPath: string) {
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true
    });
    sock.ev.on('creds.update', saveCreds);
    return sock;
  }
}
