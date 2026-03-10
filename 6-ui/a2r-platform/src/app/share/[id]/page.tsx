/**
 * Public Share Page
 * Displays a read-only view of a shared conversation
 * Route: /share/[id]
 */

import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client-sqlite';
import { chat, message, part } from '@/lib/db/schema-sqlite';
import { eq, asc } from 'drizzle-orm';
import { formatDistanceToNow } from 'date-fns';
import { Bot, User, Lock, MessageSquare, Copy, Check } from 'lucide-react';
import Link from 'next/link';

interface SharePageProps {
  params: { id: string };
}

const THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  userAccent: '#3b82f6',
  bg: '#1a1612',
  surfaceBg: '#2B2520',
  border: 'rgba(255,255,255,0.08)',
};

export default async function SharePage({ params }: SharePageProps) {
  const chatId = params.id;

  // Fetch chat with messages
  const chatData = await db
    .select()
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);

  if (chatData.length === 0) {
    notFound();
  }

  const chatRecord = chatData[0];

  // Check if chat is public
  if (chatRecord.visibility !== 'public') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: THEME.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: 400,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <Lock size={28} style={{ color: THEME.textMuted }} />
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: THEME.textPrimary,
              margin: '0 0 8px',
            }}
          >
            Private Conversation
          </h1>
          <p
            style={{
              fontSize: 15,
              color: THEME.textMuted,
              margin: 0,
            }}
          >
            This conversation is not publicly shared.
          </p>
        </div>
      </div>
    );
  }

  // Fetch messages with parts
  const messagesData = await db
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt));

  // Fetch parts for each message
  const messagesWithParts = await Promise.all(
    messagesData.map(async (msg) => {
      const partsData = await db
        .select()
        .from(part)
        .where(eq(part.messageId, msg.id))
        .orderBy(asc(part.order));

      return {
        ...msg,
        parts: partsData,
      };
    })
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: THEME.bg,
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${THEME.border}`,
          background: THEME.surfaceBg,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(212,149,106,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={18} style={{ color: THEME.accent }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: THEME.textPrimary,
                  margin: '0 0 2px',
                }}
              >
                {chatRecord.title}
              </h1>
              <p
                style={{
                  fontSize: 12,
                  color: THEME.textMuted,
                  margin: 0,
                }}
              >
                Shared {formatDistanceToNow(new Date(chatRecord.createdAt))} ago
              </p>
            </div>
          </div>

          <Link
            href="/"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${THEME.border}`,
              color: THEME.textSecondary,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            Start your own chat
          </Link>
        </div>
      </header>

      {/* Messages */}
      <main
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '32px 24px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {messagesWithParts.map((msg) => (
            <MessageView key={msg.id} message={msg} />
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 48,
            padding: '24px',
            borderRadius: 12,
            background: 'rgba(212,149,106,0.05)',
            border: `1px solid rgba(212,149,106,0.2)`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 15,
              color: THEME.textSecondary,
              margin: '0 0 16px',
            }}
          >
            Want to have similar conversations?
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 10,
              background: THEME.accent,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Bot size={18} />
            Try A2rchitech
          </Link>
        </div>
      </main>
    </div>
  );
}

interface MessageViewProps {
  message: {
    id: string;
    role: string;
    parts: Array<{
      type: string;
      text_text?: string | null;
    }>;
    createdAt: Date;
  };
}

function MessageView({ message }: MessageViewProps) {
  const isUser = message.role === 'user';

  // Combine text parts
  const textContent = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text_text)
    .join('\n');

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: isUser
            ? 'rgba(59,130,246,0.15)'
            : 'rgba(212,149,106,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUser ? (
          <User size={16} style={{ color: THEME.userAccent }} />
        ) : (
          <Bot size={16} style={{ color: THEME.accent }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isUser ? THEME.userAccent : THEME.accent,
            }}
          >
            {isUser ? 'You' : 'A2rchitect'}
          </span>
          <span
            style={{
              fontSize: 11,
              color: THEME.textMuted,
            }}
          >
            {formatDistanceToNow(new Date(message.createdAt))} ago
          </span>
        </div>

        <div
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: THEME.textPrimary,
            whiteSpace: 'pre-wrap',
          }}
        >
          {textContent}
        </div>
      </div>
    </div>
  );
}
