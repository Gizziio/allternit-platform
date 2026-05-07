#!/usr/bin/env node
/**
 * X Bookmark Cache — Media Downloader
 *
 * Downloads images and videos from the media queue.
 * Inspired by TBD's media daemon.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { getPendingMedia, markMediaDownloaded } from './db.js';

const MEDIA_DIR = path.join(os.homedir(), '.x-bookmark-cache', 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function downloadMedia(limit = 50) {
  const items = getPendingMedia(limit);
  if (!items.length) {
    console.log('[Media] Nothing to download.');
    return;
  }

  console.log(`[Media] Downloading ${items.length} media files...`);
  let success = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // Get the highest quality image variant
      let url = item.media_url;
      if (url.includes('pbs.twimg.com') || url.includes('video.twimg.com')) {
        // For images, try :large or :orig
        if (!url.includes('?') && item.media_type !== 'video') {
          url = `${url}?name=large`;
        }
      }

      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const filename = `${item.tweet_id}_${item.id}${ext}`;
      const destPath = path.join(MEDIA_DIR, filename);

      await downloadFile(url, destPath);
      markMediaDownloaded(item.id, filename);
      success++;

      // Small delay between downloads
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.warn(`[Media] Failed ${item.media_url}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[Media] Done. Success: ${success}, Failed: ${failed}`);
  console.log(`[Media] Storage: ${MEDIA_DIR}`);
}

downloadMedia();
