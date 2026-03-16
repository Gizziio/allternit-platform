/**
 * Ingest Agent - File Ingestion and Processing
 * 
 * Watches directories for new files and processes them into memories
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar from 'chokidar';
import { LocalModelManager } from '../models/local-model.js';
import { MemoryStore } from '../store/sqlite-store.js';
import type { Memory, FileType, IngestRequest, IngestResult } from '../types/memory.types.js';

/**
 * File type utilities
 */
export class FileTypeUtils {
  static getFileType(filePath: string): FileType {
    const ext = path.extname(filePath).toLowerCase();
    
    // Check code files first (more specific)
    if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp', '.swift', '.kt', '.rb', '.php', '.sql', '.sh', '.bash', '.zsh', '.fish'].includes(ext)) {
      return 'code';
    }
    
    // Check text files
    if (['.txt', '.md', '.json', '.csv', '.log', '.xml', '.yaml', '.yml', '.toml', '.ini'].includes(ext)) {
      return 'text';
    }
    
    // Check images
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.heic', '.heif'].includes(ext)) {
      return 'image';
    }
    
    // Check audio
    if (['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus'].includes(ext)) {
      return 'audio';
    }
    
    // Check video
    if (['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv'].includes(ext)) {
      return 'video';
    }
    
    // Check PDF
    if (ext === '.pdf') {
      return 'pdf';
    }
    
    // Check documents
    if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf'].includes(ext)) {
      return 'document';
    }
    
    return 'text'; // Default
  }

  static isSupported(filePath: string): boolean {
    const type = this.getFileType(filePath);
    // For now, we support text and code files directly
    // Images, audio, video would need additional processing
    return type === 'text' || type === 'code';
  }
}

/**
 * File content extractor
 */
export class ContentExtractor {
  /**
   * Extract text content from a file
   */
  static async extract(filePath: string): Promise<string> {
    const fileType = FileTypeUtils.getFileType(filePath);
    
    switch (fileType) {
      case 'text':
      case 'code':
        return await this.extractTextFile(filePath);
      case 'pdf':
        return await this.extractPdf(filePath);
      case 'image':
        return await this.extractImage(filePath);
      case 'audio':
        return await this.extractAudio(filePath);
      case 'video':
        return await this.extractVideo(filePath);
      default:
        return await this.extractTextFile(filePath);
    }
  }

  private static async extractTextFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async extractPdf(filePath: string): Promise<string> {
    // PDF extraction would require additional libraries like pdf-parse
    // For now, return a placeholder
    return `[PDF File: ${path.basename(filePath)}] - PDF extraction requires additional setup`;
  }

  private static async extractImage(filePath: string): Promise<string> {
    // Image analysis would require vision model
    // For now, return a placeholder
    return `[Image: ${path.basename(filePath)}] - Image analysis requires vision model`;
  }

  private static async extractAudio(filePath: string): Promise<string> {
    // Audio transcription would require whisper or similar
    // For now, return a placeholder
    return `[Audio: ${path.basename(filePath)}] - Audio transcription requires additional setup`;
  }

  private static async extractVideo(filePath: string): Promise<string> {
    // Video analysis would require multiple steps
    // For now, return a placeholder
    return `[Video: ${path.basename(filePath)}] - Video analysis requires additional setup`;
  }
}

/**
 * Ingest Agent configuration
 */
export interface IngestAgentConfig {
  watchDirectory: string;
  pollIntervalMs?: number;
  debounceMs?: number;
}

/**
 * Ingest Agent class
 */
export class IngestAgent {
  private modelManager: LocalModelManager;
  private store: MemoryStore;
  private config: IngestAgentConfig;
  private watcher?: chokidar.FSWatcher;
  private processedFiles: Set<string> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    modelManager: LocalModelManager,
    store: MemoryStore,
    config: IngestAgentConfig
  ) {
    this.modelManager = modelManager;
    this.store = store;
    this.config = {
      watchDirectory: config.watchDirectory,
      pollIntervalMs: config.pollIntervalMs || 1000,
      debounceMs: config.debounceMs || 2000,
    };
  }

  /**
   * Start watching directory for new files
   */
  async startWatching(): Promise<void> {
    const watchDir = this.config.watchDirectory;
    
    // Ensure watch directory exists
    try {
      await fs.access(watchDir);
    } catch {
      await fs.mkdir(watchDir, { recursive: true });
      console.log(`Created watch directory: ${watchDir}`);
    }

    // Set up file watcher
    this.watcher = chokidar.watch(watchDir, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath: string) => this.handleFileAdd(filePath))
      .on('change', (filePath: string) => this.handleFileChange(filePath))
      .on('unlink', (filePath: string) => this.handleFileRemove(filePath));

    console.log(`IngestAgent: Watching directory: ${watchDir}`);
  }

  /**
   * Stop watching directory
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      console.log('IngestAgent: Stopped watching directory');
    }
  }

  /**
   * Handle file add event
   */
  private async handleFileAdd(filePath: string): Promise<void> {
    console.log(`IngestAgent: File added: ${filePath}`);
    await this.processFile(filePath);
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(filePath: string): Promise<void> {
    console.log(`IngestAgent: File changed: ${filePath}`);
    // Debounce rapid changes
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath)!);
    }
    
    const timer = setTimeout(async () => {
      await this.processFile(filePath);
      this.debounceTimers.delete(filePath);
    }, this.config.debounceMs);
    
    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Handle file remove event
   */
  private async handleFileRemove(filePath: string): Promise<void> {
    console.log(`IngestAgent: File removed: ${filePath}`);
    // Optionally remove associated memory
    this.processedFiles.delete(filePath);
  }

  /**
   * Process a single file
   */
  async processFile(filePath: string): Promise<IngestResult> {
    // Check if file is supported
    if (!FileTypeUtils.isSupported(filePath)) {
      console.log(`IngestAgent: Unsupported file type: ${filePath}`);
      return {
        success: false,
        error: `Unsupported file type: ${path.extname(filePath)}`,
      };
    }

    // Check if already processed recently
    if (this.processedFiles.has(filePath)) {
      console.log(`IngestAgent: File already processed: ${filePath}`);
      return {
        success: false,
        error: 'File already processed',
      };
    }

    try {
      // Extract content
      const content = await ContentExtractor.extract(filePath);
      
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: 'File is empty',
        };
      }

      // Process content into memory
      const result = await this.ingestContent({
        content,
        filePath,
        source: path.basename(filePath),
      });

      if (result.success) {
        this.processedFiles.add(filePath);
      }

      return result;
    } catch (error) {
      console.error(`IngestAgent: Error processing file ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Ingest content directly (without file)
   */
  async ingestContent(request: IngestRequest): Promise<IngestResult> {
    const content = request.content || '';
    
    if (!content.trim()) {
      return {
        success: false,
        error: 'Empty content',
      };
    }

    try {
      // Determine file type
      const sourceType: FileType = request.filePath 
        ? FileTypeUtils.getFileType(request.filePath)
        : 'text';

      // Process with LLM
      console.log('IngestAgent: Processing content with LLM...');
      
      // Extract summary, entities, topics
      const [summary, { entities, topics }, importance] = await Promise.all([
        this.modelManager.summarize(content, 150),
        this.modelManager.extractEntities(content),
        this.modelManager.assessImportance(content),
      ]);

      // Create memory
      const memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'> = {
        content,
        summary,
        entities,
        topics,
        importance,
        status: 'raw',
        source: request.source || 'direct-input',
        sourceType,
        metadata: request.metadata || {},
      };

      const createdMemory = this.store.createMemory(memory);
      
      console.log(`IngestAgent: Created memory ${createdMemory.id} with importance ${importance}`);

      return {
        success: true,
        memoryId: createdMemory.id,
      };
    } catch (error) {
      console.error('IngestAgent: Error ingesting content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process all files in watch directory (initial scan)
   */
  async processExistingFiles(): Promise<void> {
    const watchDir = this.config.watchDirectory;
    
    try {
      const files = await fs.readdir(watchDir);
      
      for (const file of files) {
        const filePath = path.join(watchDir, file);
        
        // Skip directories and dotfiles
        const stat = await fs.stat(filePath);
        if (stat.isFile() && !file.startsWith('.')) {
          await this.processFile(filePath);
        }
      }
      
      console.log(`IngestAgent: Processed ${files.length} existing files`);
    } catch (error) {
      console.error('IngestAgent: Error processing existing files:', error);
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    processedFilesCount: number;
    activeWatchers: boolean;
  } {
    return {
      processedFilesCount: this.processedFiles.size,
      activeWatchers: !!this.watcher,
    };
  }
}
