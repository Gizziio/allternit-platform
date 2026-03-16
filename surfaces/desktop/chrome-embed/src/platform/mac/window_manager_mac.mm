/**
 * Window Manager - macOS
 * 
 * Helper utilities for window management on macOS.
 */

#import <Cocoa/Cocoa.h>
#include <cstdint>

/**
 * Get the NSWindow from a CGWindowID
 */
inline NSWindow* GetWindowFromId(CGWindowID windowId) {
    return [NSWindow windowWithWindowNumber:windowId];
}

/**
 * Check if a window belongs to a specific process
 */
inline bool IsWindowForProcess(CGWindowID windowId, int32_t pid) {
    NSDictionary* info = [NSWindow windowInformationWithWindowNumber:windowId options:0];
    if (!info) return false;
    
    NSNumber* ownerPid = info[@"kCGWindowOwnerPID"];
    return [ownerPid isEqualToNumber:@(pid)];
}

/**
 * Set a window's parent to another view
 */
inline bool ReparentWindow(NSWindow* childWindow, NSView* parentView) {
    if (!childWindow || !parentView) return false;
    
    // Remove from current parent
    [childWindow.contentView removeFromSuperview];
    
    // Add to new parent
    childWindow.contentView.frame = parentView.bounds;
    childWindow.contentView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    [parentView addSubview:childWindow.contentView];
    
    return true;
}

/**
 * Position a window relative to a container
 */
inline void PositionWindowInContainer(NSWindow* window, NSView* container, 
                                       int32_t x, int32_t y, 
                                       int32_t width, int32_t height) {
    if (!window || !window.contentView) return;
    
    window.contentView.frame = NSMakeRect(x, y, width, height);
}
