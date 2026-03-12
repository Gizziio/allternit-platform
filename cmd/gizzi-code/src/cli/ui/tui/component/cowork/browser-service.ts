/**
 * Browser Service - Integration with a2r-browser-dev skill
 * 
 * Uses Chrome DevTools Protocol (CDP) via agent-browser CLI
 * No Puppeteer needed - uses existing robust browser automation
 * 
 * Features:
 * - Launch Chrome with CDP (--remote-debugging-port=9222)
 * - Navigate to URLs
 * - Take screenshots
 * - Execute JavaScript
 * - Element interaction (click, fill, etc.)
 * - Tab management
 */

import { spawn, type ChildProcess } from "child_process"
import { Log } from "@/shared/util/log"
import { EventEmitter } from "events"

const CDP_PORT = 9222
const BROWSER_COMMAND = "a2r-browser-dev" // Use the correct skill command

export interface BrowserStatus {
  state: "closed" | "opening" | "open" | "error"
  url?: string
  title?: string
  error?: string
}

export interface BrowserOptions {
  port?: number
  headless?: boolean
  windowPosition?: { x: number; y: number }
  windowSize?: { width: number; height: number }
}

export class BrowserService extends EventEmitter {
  private status: BrowserStatus = { state: "closed" }
  private chromeProcess: ChildProcess | null = null
  private port: number = CDP_PORT
  
  constructor() {
    super()
  }
  
  /**
   * Get current browser status
   */
  getStatus(): BrowserStatus {
    return { ...this.status }
  }
  
  /**
   * Launch Chrome with CDP enabled
   */
  async launch(options?: BrowserOptions): Promise<void> {
    if (this.status.state === "open") {
      Log.Default.info("browser: Already open", { url: this.status.url })
      return
    }
    
    try {
      this.status = { state: "opening" }
      this.emit("status-change", this.status)
      
      this.port = options?.port || CDP_PORT
      
      // Launch Chrome with CDP
      // On macOS, use 'open' command
      const isMacOS = process.platform === "darwin"
      
      if (isMacOS) {
        this.chromeProcess = spawn("open", [
          "-a",
          "Google Chrome",
          "--args",
          `--remote-debugging-port=${this.port}`,
          "--no-first-run",
          "--no-default-browser-check",
        ])
      } else {
        // Linux/Windows - try direct chrome/chromium command
        const chromeCmd = process.platform === "win32" 
          ? "chrome" 
          : "google-chrome"
        
        this.chromeProcess = spawn(chromeCmd, [
          `--remote-debugging-port=${this.port}`,
          "--no-first-run",
          "--no-default-browser-check",
        ])
      }
      
      this.chromeProcess.on("error", (error) => {
        Log.Default.error("browser: Failed to launch Chrome", { error })
        this.status = { 
          state: "error", 
          error: `Failed to launch Chrome: ${error.message}` 
        }
        this.emit("status-change", this.status)
      })
      
      this.chromeProcess.on("exit", (code) => {
        Log.Default.info("browser: Chrome exited", { code })
        this.status = { state: "closed" }
        this.emit("status-change", this.status)
      })
      
      // Wait for Chrome to start
      await this.waitForBrowser()
      
      this.status = { 
        state: "open",
        url: "about:blank",
        title: "New Tab"
      }
      this.emit("status-change", this.status)
      
      Log.Default.info("browser: Launched successfully", { port: this.port })
    } catch (error) {
      this.status = { 
        state: "error", 
        error: error instanceof Error ? error.message : "Unknown error" 
      }
      this.emit("status-change", this.status)
      throw error
    }
  }
  
  /**
   * Close Chrome
   */
  async close(): Promise<void> {
    if (this.status.state !== "open") {
      return
    }
    
    try {
      // Use agent-browser to close
      await this.execCommand(["close"])
      
      if (this.chromeProcess) {
        this.chromeProcess.kill()
        this.chromeProcess = null
      }
      
      this.status = { state: "closed" }
      this.emit("status-change", this.status)
      
      Log.Default.info("browser: Closed successfully")
    } catch (error) {
      Log.Default.error("browser: Failed to close", { error })
      // Force kill anyway
      if (this.chromeProcess) {
        this.chromeProcess.kill()
        this.chromeProcess = null
      }
      this.status = { state: "closed" }
      this.emit("status-change", this.status)
    }
  }
  
  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    if (this.status.state !== "open") {
      await this.launch()
    }
    
    try {
      await this.execCommand(["navigate", url])
      
      this.status = { 
        ...this.status,
        state: "open",
        url,
        title: url
      }
      this.emit("status-change", this.status)
      this.emit("navigate", url)
      
      Log.Default.info("browser: Navigated", { url })
    } catch (error) {
      Log.Default.error("browser: Navigation failed", { error })
      throw error
    }
  }
  
  /**
   * Take screenshot
   * Returns screenshot as Buffer (PNG)
   */
  async screenshot(): Promise<Buffer> {
    if (this.status.state !== "open") {
      throw new Error("Browser is not open")
    }
    
    try {
      // Use agent-browser screenshot command with stdout (no file path)
      const result = await this.execCommandWithOutput(["screenshot", "--stdout"])
      
      Log.Default.info("browser: Screenshot taken")
      return result
    } catch (error) {
      Log.Default.error("browser: Screenshot failed", { error })
      throw error
    }
  }
  
  /**
   * Execute JavaScript in page
   */
  async evaluate(script: string): Promise<any> {
    if (this.status.state !== "open") {
      throw new Error("Browser is not open")
    }
    
    try {
      const result = await this.execCommandWithOutput([
        "eval",
        script
      ])
      
      const text = result.toString()
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    } catch (error) {
      Log.Default.error("browser: Evaluate failed", { error })
      throw error
    }
  }
  
  /**
   * Click element
   */
  async click(selector: string): Promise<void> {
    if (this.status.state !== "open") {
      throw new Error("Browser is not open")
    }
    
    try {
      await this.execCommand(["click", selector])
      Log.Default.info("browser: Clicked", { selector })
    } catch (error) {
      Log.Default.error("browser: Click failed", { error })
      throw error
    }
  }
  
  /**
   * Fill input field
   */
  async fill(selector: string, value: string): Promise<void> {
    if (this.status.state !== "open") {
      throw new Error("Browser is not open")
    }
    
    try {
      await this.execCommand(["fill", selector, value])
      Log.Default.info("browser: Filled", { selector, value })
    } catch (error) {
      Log.Default.error("browser: Fill failed", { error })
      throw error
    }
  }
  
  /**
   * Get list of tabs
   */
  async tabs(): Promise<any[]> {
    try {
      const result = await this.execCommandWithOutput(["tab"])
      const text = result.toString()
      try {
        return JSON.parse(text)
      } catch {
        return []
      }
    } catch (error) {
      Log.Default.error("browser: Tab list failed", { error })
      return []
    }
  }
  
  /**
   * Switch to tab
   */
  async switchTab(index: number): Promise<void> {
    if (this.status.state !== "open") {
      throw new Error("Browser is not open")
    }
    
    try {
      await this.execCommand(["tab", index.toString()])
      Log.Default.info("browser: Switched to tab", { index })
    } catch (error) {
      Log.Default.error("browser: Tab switch failed", { error })
      throw error
    }
  }
  
  /**
   * Execute agent-browser command
   */
  private async execCommand(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const fullArgs = [...args]
      
      const proc = spawn(BROWSER_COMMAND, fullArgs, {
        stdio: ["ignore", "pipe", "pipe"]
      })
      
      let stdout = ""
      let stderr = ""
      
      proc.stdout.on("data", (data) => {
        stdout += data.toString()
      })
      
      proc.stderr.on("data", (data) => {
        stderr += data.toString()
      })
      
      proc.on("close", (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`))
        }
      })
      
      proc.on("error", reject)
    })
  }
  
  /**
   * Execute command and return output
   */
  private async execCommandWithOutput(args: string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const proc = spawn(BROWSER_COMMAND, args, {
        stdio: ["ignore", "pipe", "pipe"]
      })
      
      const chunks: Buffer[] = []
      
      proc.stdout.on("data", (data: Buffer) => {
        chunks.push(data)
      })
      
      proc.stderr.on("data", (data) => {
        Log.Default.debug("browser: stderr", { data: data.toString() })
      })
      
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks))
        } else {
          reject(new Error(`Command failed with code ${code}`))
        }
      })
      
      proc.on("error", reject)
    })
  }
  
  /**
   * Wait for browser to be ready
   */
  private async waitForBrowser(maxAttempts = 30, delay = 100): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/json/version`)
        if (response.ok) {
          return
        }
      } catch {
        // Browser not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    throw new Error("Browser failed to start")
  }
}

// Singleton instance
let browserInstance: BrowserService | null = null

export function getBrowserService(): BrowserService {
  if (!browserInstance) {
    browserInstance = new BrowserService()
  }
  return browserInstance
}
