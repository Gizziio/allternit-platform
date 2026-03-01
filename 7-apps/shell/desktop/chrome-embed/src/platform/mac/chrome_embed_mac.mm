/**
 * Chrome Embed - macOS Implementation
 * 
 * Launches Chrome in app mode and positions it over the Electron window
 * to create the visual effect of embedding.
 */

#include <napi.h>
#import <Cocoa/Cocoa.h>
#import <Foundation/Foundation.h>
#include <thread>
#include <chrono>

// Global state
static int32_t g_chromePid = 0;
static NSWindow* g_electronWindow = nil;

/**
 * Find Chrome's window and position it
 */
static bool PositionChromeOverWindow(int32_t pid, NSWindow* targetWindow, int32_t x, int32_t y, int32_t width, int32_t height) {
    // Wait for Chrome to create its window
    for (int i = 0; i < 30; i++) {
        CFArrayRef windowList = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID);
        if (!windowList) {
            [NSThread sleepForTimeInterval:0.3];
            continue;
        }
        
        CFIndex count = CFArrayGetCount(windowList);
        CFNumberRef targetPidRef = CFNumberCreate(kCFAllocatorDefault, kCFNumberIntType, &pid);
        bool found = false;
        
        for (CFIndex i = 0; i < count; i++) {
            CFDictionaryRef windowInfo = (CFDictionaryRef)CFArrayGetValueAtIndex(windowList, i);
            CFNumberRef ownerPidRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowOwnerPID);
            
            if (ownerPidRef && CFNumberCompare(ownerPidRef, targetPidRef, nil) == kCFCompareEqualTo) {
                CFNumberRef windowIdRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowNumber);
                if (windowIdRef) {
                    int32_t windowId;
                    CFNumberGetValue(windowIdRef, kCFNumberIntType, &windowId);
                    
                    // Found Chrome window - now position it using AppleScript
                    NSString* script = [NSString stringWithFormat:
                        @"tell application \"System Events\"\n"
                        @"  set chromeWindows to windows of application process \"Google Chrome\"\n"
                        @"  if (count of chromeWindows) > 0 then\n"
                        @"    set chromeWindow to first item of chromeWindows\n"
                        @"    set position of chromeWindow to {%d, %d}\n"
                        @"    set size of chromeWindow to {%d, %d}\n"
                        @"  end if\n"
                        @"end tell",
                        x, y, width, height
                    ];
                    
                    NSAppleScript* appleScript = [[NSAppleScript alloc] initWithSource:script];
                    NSDictionary* error = nil;
                    [appleScript executeAndReturnError:&error];
                    
                    found = (error == nil);
                }
                break;
            }
        }
        
        CFRelease(targetPidRef);
        CFRelease(windowList);
        
        if (found) {
            return true;
        }
        
        [NSThread sleepForTimeInterval:0.3];
    }
    
    return false;
}

/**
 * Get screen coordinates from Electron window
 */
static void GetWindowBounds(NSWindow* window, int32_t* x, int32_t* y, int32_t* width, int32_t* height) {
    if (!window) return;
    
    NSRect frame = [window frame];
    NSRect contentRect = [window contentRectForFrameRect:frame];
    
    // Convert to screen coordinates
    NSPoint origin = [window cascadeTopLeftFromPoint:NSMakePoint(contentRect.origin.x, contentRect.origin.y)];
    
    *x = (int32_t)origin.x;
    *y = (int32_t)(origin.y - contentRect.size.height);  // Flip Y axis
    *width = (int32_t)contentRect.size.width;
    *height = (int32_t)contentRect.size.height;
}

/**
 * Launch Chrome browser process
 */
Napi::Value LaunchChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "URL and window handle required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string url = info[0].As<Napi::String>().Utf8Value();
    int64_t windowHandle = info[1].As<Napi::Number>().Int64Value();
    
    @autoreleasepool {
        NSString* chromePath = @"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
        NSString* chromeUrl = [NSString stringWithUTF8String:url.c_str()];
        
        // Get Electron window
        g_electronWindow = (__bridge NSWindow*)(void*)windowHandle;
        
        // Get window bounds for positioning
        int32_t winX, winY, winWidth, winHeight;
        GetWindowBounds(g_electronWindow, &winX, &winY, &winWidth, &winHeight);
        
        // Launch Chrome in NORMAL mode (not app mode) so websites recognize it
        NSArray* args = @[
            chromeUrl,  // Just open URL normally, not --app=
            @"--no-first-run",
            @"--disable-features=ChromeWhatsNewUI",
            @"--remote-debugging-port=9222"
        ];
        
        NSTask* task = [[NSTask alloc] init];
        task.launchPath = chromePath;
        task.arguments = args;
        
        NSError* error = nil;
        if (![task launchAndReturnError:&error]) {
            std::string errorMsg = error ? [error.localizedDescription UTF8String] : "Unknown error";
            Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
            return env.Null();
        }
        
        int32_t pid = (int32_t)task.processIdentifier;
        g_chromePid = pid;
        
        // Wait for Chrome window and position it
        [NSThread sleepForTimeInterval:1.0];
        bool positioned = PositionChromeOverWindow(pid, g_electronWindow, winX, winY, winWidth, winHeight);
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", true);
        result.Set("pid", pid);
        result.Set("platform", "macos");
        result.Set("positioned", positioned);
        
        return result;
    }
}

/**
 * Reposition Chrome when Electron window moves/resizes
 */
Napi::Value RepositionChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Window handle required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int64_t windowHandle = info[0].As<Napi::Number>().Int64Value();
    
    if (g_chromePid <= 0) {
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", false);
        result.Set("error", "Chrome not running");
        return result;
    }
    
    @autoreleasepool {
        g_electronWindow = (__bridge NSWindow*)(void*)windowHandle;
        
        int32_t winX, winY, winWidth, winHeight;
        GetWindowBounds(g_electronWindow, &winX, &winY, &winWidth, &winHeight);
        
        bool positioned = PositionChromeOverWindow(g_chromePid, g_electronWindow, winX, winY, winWidth, winHeight);
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", positioned);
        return result;
    }
}

/**
 * Close Chrome
 */
Napi::Value CloseChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    @autoreleasepool {
        // Close Chrome via AppleScript
        NSString* script = @"tell application \"Google Chrome\" to quit";
        NSAppleScript* appleScript = [[NSAppleScript alloc] initWithSource:script];
        [appleScript executeAndReturnError:nil];
        
        // Also kill the process
        if (g_chromePid > 0) {
            kill(g_chromePid, SIGTERM);
        }
        
        g_chromePid = 0;
        g_electronWindow = nil;
    }
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("success", true);
    return result;
}

/**
 * Navigate Chrome to URL
 */
Napi::Value NavigateChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "URL required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string url = info[0].As<Napi::String>().Utf8Value();
    
    if (g_chromePid <= 0) {
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", false);
        result.Set("error", "Chrome not running");
        return result;
    }
    
    @autoreleasepool {
        NSString* jsUrl = [NSString stringWithUTF8String:url.c_str()];
        NSString* script = [NSString stringWithFormat:
            @"tell application \"Google Chrome\"\n"
            @"  set URL of active tab of first window to \"%@\"\n"
            @"end tell", jsUrl];
        
        NSAppleScript* appleScript = [[NSAppleScript alloc] initWithSource:script];
        NSDictionary* error = nil;
        [appleScript executeAndReturnError:&error];
        
        Napi::Object result = Napi::Object::New(env);
        if (error) {
            result.Set("success", false);
            NSString* errorMsg = [error objectForKey:NSAppleScriptErrorMessage];
            result.Set("error", errorMsg ? [errorMsg UTF8String] : "Unknown error");
        } else {
            result.Set("success", true);
        }
        
        return result;
    }
}

/**
 * Get platform info
 */
Napi::Value GetPlatform(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("name", "macos");
    result.Set("windowSystem", "cocoa");
    result.Set("arch", "arm64");
    
    return result;
}

/**
 * Check if Chrome is running
 */
Napi::Value IsChromeRunning(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("running", g_chromePid > 0);
    result.Set("pid", g_chromePid);
    
    return result;
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("launchChrome", Napi::Function::New(env, LaunchChrome));
    exports.Set("repositionChrome", Napi::Function::New(env, RepositionChrome));
    exports.Set("closeChrome", Napi::Function::New(env, CloseChrome));
    exports.Set("navigateChrome", Napi::Function::New(env, NavigateChrome));
    exports.Set("getPlatform", Napi::Function::New(env, GetPlatform));
    exports.Set("isChromeRunning", Napi::Function::New(env, IsChromeRunning));
    return exports;
}

NODE_API_MODULE(chrome_embed, Init)
