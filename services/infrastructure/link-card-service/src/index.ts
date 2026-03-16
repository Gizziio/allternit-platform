import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { CardRenderSchema, renderCard } from './renderer.js';
import { initDB, saveLink, getLink, saveSession, getSession } from './db.js';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3090);
const HOST = process.env.HOST || "127.0.0.1";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const OVERLAY_URL = process.env.OVERLAY_URL || 'http://localhost:5173'; 

// Key Management (RSA)
let PRIVATE_KEY: string;
let PUBLIC_KEY: string;

try {
  if (fs.existsSync('private.pem') && fs.existsSync('public.pem')) {
    PRIVATE_KEY = fs.readFileSync('private.pem', 'utf8');
    PUBLIC_KEY = fs.readFileSync('public.pem', 'utf8');
  } else {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    PRIVATE_KEY = privateKey;
    PUBLIC_KEY = publicKey;
    fs.writeFileSync('private.pem', PRIVATE_KEY);
    fs.writeFileSync('public.pem', PUBLIC_KEY);
    console.log('Generated new RSA keys');
  }
} catch (e) {
  console.error('Failed to load/generate keys', e);
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for session dumps

// Initialize DB on start
initDB().then(() => console.log('Database initialized'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'link-card-service' });
});

// Public Key Endpoint (for clients to verify)
app.get('/.well-known/jwks.json', (req, res) => {
    // Mock JWK for RSA (would need proper conversion lib in prod)
    res.json({ keys: [] });
});

// --- Session Handoff Endpoints ---

app.post('/session', async (req, res) => {
    try {
        const id = crypto.randomUUID();
        await saveSession(id, req.body);
        res.json({ id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to save session' });
    }
});

app.get('/session/:id', async (req, res) => {
    try {
        const data = await getSession(req.params.id);
        if (!data) return res.status(404).json({ error: 'Session not found' });
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to load session' });
    }
});

// --- Link Card Endpoints ---

// 1. Render Card & Generate Link
app.post('/card/render', async (req, res) => {
  try {
    const payload = CardRenderSchema.parse(req.body);
    
    // Generate deterministic ID based on content (SHA-256)
    const contentStr = JSON.stringify(payload);
    const cardId = crypto.createHash('sha256').update(contentStr).digest('base64url').substring(0, 12);
    
    // Store render params persistantly
    await saveLink(cardId, payload);

    // Sign with RSA (RS256)
    const token = jwt.sign({ 
        session_id: `sess-${cardId}`, 
        entrypoint: 'overlay',
        nonce: Date.now() 
    }, PRIVATE_KEY, { algorithm: 'RS256', expiresIn: '15m' });

    res.json({
      card_image_url: `${BASE_URL}/assets/${cardId}.png`,
      og_page_url: `${BASE_URL}/o/${cardId}`,
      open_url: `${BASE_URL}/o/${cardId}`, 
      sid: token
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid request' });
  }
});

// 2. Serve Card Image
app.get('/assets/:id.png', async (req, res) => {
  const data = await getLink(req.params.id);
  if (!data) return res.status(404).send('Not found');
  
  const buffer = renderCard(data);
  
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});

// 3. OG Page / Redirect
app.get('/o/:id', async (req, res) => {
  const id = req.params.id;
  const data = await getLink(id);
  
  // If user-agent is a bot (Slack, iMessage, Twitter), serve HTML with OG tags
  const ua = req.headers['user-agent'] || '';
  const isBot = /bot|facebookexternalhit|WhatsApp|Slack|Twitter|Discord/i.test(ua);
  
  if (isBot && data) {
    const imageUrl = `${BASE_URL}/assets/${id}.png`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta property="og:title" content="${data.title}" />
        <meta property="og:description" content="${data.subtitle || 'a2rchitech session'}" />
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body>
        <h1>Redirecting...</h1>
      </body>
      </html>
    `;
    return res.send(html);
  }

  // Otherwise, redirect to Overlay with SID
  const token = jwt.sign({ 
    session_id: `sess-${id}`, 
    entrypoint: 'overlay', 
    nonce: Date.now() 
  }, PRIVATE_KEY, { algorithm: 'RS256', expiresIn: '15m' });

  res.redirect(`${OVERLAY_URL}?sid=${token}`);
});

app.listen(PORT, HOST, () => {
  console.log(`Link Service running on ${BASE_URL}`);
});
