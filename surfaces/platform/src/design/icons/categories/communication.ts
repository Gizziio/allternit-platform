/**
 * Communication Icons
 * 
 * Icons for messaging, notifications, and communication features.
 * 
 * @module @a2r/platform/icons/categories/communication
 */

export const communicationIcons = [
  'chat',
  'message',
  'email',
  'phone',
  'video-call',
  'share',
  'notification',
  'bell',
  'mention',
  'mail',
  'inbox',
  'send-message',
  'reply',
  'forward-message',
  'phone-call',
  'voicemail',
  'rss',
  'wifi',
  'wifi-off',
] as const;

export type CommunicationIcon = typeof communicationIcons[number];
