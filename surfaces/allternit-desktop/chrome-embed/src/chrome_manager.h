/**
 * Chrome Embed Platform Abstraction
 * 
 * Common types and interfaces used across all platforms.
 */

#ifndef CHROME_EMBED_H
#define CHROME_EMBED_H

#include <string>
#include <cstdint>

#if defined(__APPLE__)
#include <ApplicationServices/ApplicationServices.h>
typedef CGWindowID WindowHandle;
#elif defined(_WIN32)
#include <windows.h>
typedef HWND WindowHandle;
#elif defined(__linux__)
#include <X11/Xlib.h>
typedef Window WindowHandle;
#endif

/**
 * Chrome process information
 */
struct ChromeProcess {
    int32_t pid;
    std::string platform;
    WindowHandle mainWindow;
};

/**
 * Window bounds rectangle
 */
struct WindowBounds {
    int32_t x;
    int32_t y;
    int32_t width;
    int32_t height;
    bool visible;
};

/**
 * Launch Chrome browser process in app mode
 * 
 * @param url URL to open in Chrome
 * @return ChromeProcess with PID and window handle
 */
ChromeProcess LaunchChromeProcess(const std::string& url);

/**
 * Embed Chrome window into a container window
 * 
 * @param containerHandle Native window handle of container
 * @return true if successful
 */
bool EmbedChromeWindow(WindowHandle containerHandle);

/**
 * Resize embedded Chrome window
 * 
 * @param x X position relative to container
 * @param y Y position relative to container
 * @param width Width in pixels
 * @param height Height in pixels
 * @return true if successful
 */
bool ResizeChromeWindow(int32_t x, int32_t y, int32_t width, int32_t height);

/**
 * Close Chrome window and process
 * 
 * @return true if successful
 */
bool CloseChromeWindow();

/**
 * Navigate Chrome to a new URL
 * 
 * @param url URL to navigate to
 * @return true if successful
 */
bool NavigateChromeWindow(const std::string& url);

/**
 * Get current Chrome window bounds
 * 
 * @return WindowBounds structure
 */
WindowBounds GetChromeWindowBounds();

/**
 * Find Chrome's main window for a given process
 * 
 * @param pid Process ID of Chrome
 * @return WindowHandle or 0 if not found
 */
WindowHandle FindChromeWindow(int32_t pid);

#endif // CHROME_EMBED_H
