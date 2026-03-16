#!/usr/bin/env node
/**
 * Lightweight File Watcher for Inbox
 * Watches for new files and queues them for ingestion
 * Runs 24/7 with minimal resources
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar from 'chokidar';

const INBOX_DIR = process.env.MEMORY_WATCH_DIRECTORY || './inbox';
const PROCESSED_DIR = './inbox/.processed';
const LOG_FILE = '/tmp/memory-watcher.log';

// Simple logging
function log(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}`;
    console.log(line);
    fs.appendFile(LOG_FILE, line + '\n').catch(() => {});
}

// Ensure directories exist
async function setup() {
    await fs.mkdir(INBOX_DIR, { recursive: true });
    await fs.mkdir(PROCESSED_DIR, { recursive: true });
    log(`Watching directory: ${INBOX_DIR}`);
}

// Mark file as processed
async function markProcessed(filePath) {
    const fileName = path.basename(filePath);
    const processedPath = path.join(PROCESSED_DIR, `${fileName}.${Date.now()}`);
    try {
        await fs.copyFile(filePath, processedPath);
        log(`Marked as processed: ${fileName}`);
    } catch (e) {
        log(`Error marking processed: ${e.message}`);
    }
}

// Simple file ingestion (just record for later processing)
async function queueForIngestion(filePath) {
    const fileName = path.basename(filePath);
    const queueFile = '/tmp/memory-ingest-queue.json';
    
    try {
        // Read existing queue
        let queue = [];
        try {
            const content = await fs.readFile(queueFile, 'utf-8');
            queue = JSON.parse(content);
        } catch (e) {
            // Queue doesn't exist yet
        }
        
        // Add to queue
        queue.push({
            file: filePath,
            name: fileName,
            queued_at: new Date().toISOString(),
            status: 'pending'
        });
        
        // Write queue
        await fs.writeFile(queueFile, JSON.stringify(queue, null, 2));
        log(`Queued for ingestion: ${fileName}`);
        
    } catch (e) {
        log(`Error queueing file: ${e.message}`);
    }
}

// Main watcher
async function startWatcher() {
    await setup();
    
    const watcher = chokidar.watch(INBOX_DIR, {
        ignored: [/(^|[\/\\])\../, /\.processed/], // Ignore dotfiles and processed
        persistent: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000, // Wait 2s after write completes
            pollInterval: 100
        }
    });
    
    watcher
        .on('add', async (filePath) => {
            const fileName = path.basename(filePath);
            log(`📁 New file detected: ${fileName}`);
            
            // Skip if already processed
            const processedFiles = await fs.readdir(PROCESSED_DIR);
            if (processedFiles.some(f => f.startsWith(fileName))) {
                log(`Skipping (already processed): ${fileName}`);
                return;
            }
            
            // Queue for ingestion
            await queueForIngestion(filePath);
        })
        .on('error', (error) => {
            log(`Watcher error: ${error.message}`);
        });
    
    log('✅ File watcher started');
    log(`Inbox: ${INBOX_DIR}`);
    log(`Processed: ${PROCESSED_DIR}`);
    log(`Queue: /tmp/memory-ingest-queue.json`);
    log('');
    log('Drop files in inbox to queue for ingestion.');
    log('Files are processed during daily consolidation.');
}

// Handle shutdown
process.on('SIGINT', () => {
    log('Shutting down watcher...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Shutting down watcher...');
    process.exit(0);
});

// Start
startWatcher().catch(e => {
    log(`Fatal error: ${e.message}`);
    process.exit(1);
});
