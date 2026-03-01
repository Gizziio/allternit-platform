/**
 * Chrome Embed Native Module
 * 
 * Provides native window embedding functionality for embedding
 * Chrome browser windows inside Electron applications.
 * 
 * Cross-platform support:
 * - macOS: Uses NSWindow reparenting via Cocoa
 * - Windows: Uses SetParent HWND API
 * - Linux: Uses X11 window reparenting
 */

#include <napi.h>
#include <string>
#include <thread>
#include <chrono>

// Platform-specific implementations
#if defined(__APPLE__)
#include "platform/mac/chrome_embed_mac.h"
#elif defined(_WIN32)
#include "platform/win/chrome_embed_win.h"
#elif defined(__linux__)
#include "platform/linux/chrome_embed_linux.h"
#endif

/**
 * Launch Chrome browser in app mode
 * Args: [url: string]
 * Returns: { success: boolean, pid: number }
 */
Napi::Value LaunchChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "URL argument required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string url = info[0].As<Napi::String>().Utf8Value();
    
    try {
        ChromeProcess process = LaunchChromeProcess(url);
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", true);
        result.Set("pid", static_cast<double>(process.pid));
        result.Set("platform", process.platform);
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to launch Chrome: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Embed Chrome window into container
 * Args: [containerHandle: number]
 * Returns: { success: boolean }
 */
Napi::Value EmbedChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Container handle required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int64_t containerHandle = info[0].As<Napi::Number>().Int64Value();
    
    try {
        bool success = EmbedChromeWindow(static_cast<WindowHandle>(containerHandle));
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", success);
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to embed Chrome: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Resize embedded Chrome window
 * Args: [x: number, y: number, width: number, height: number]
 * Returns: { success: boolean }
 */
Napi::Value ResizeChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 4) {
        Napi::TypeError::New(env, "x, y, width, height arguments required")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int32_t x = info[0].As<Napi::Number>().Int32Value();
    int32_t y = info[1].As<Napi::Number>().Int32Value();
    int32_t width = info[2].As<Napi::Number>().Int32Value();
    int32_t height = info[3].As<Napi::Number>().Int32Value();
    
    try {
        bool success = ResizeChromeWindow(x, y, width, height);
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", success);
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to resize Chrome: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Close embedded Chrome window
 * Args: []
 * Returns: { success: boolean }
 */
Napi::Value CloseChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        bool success = CloseChromeWindow();
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", success);
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to close Chrome: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Navigate Chrome to new URL
 * Args: [url: string]
 * Returns: { success: boolean }
 */
Napi::Value NavigateChrome(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "URL argument required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string url = info[0].As<Napi::String>().Utf8Value();
    
    try {
        bool success = NavigateChromeWindow(url);
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("success", success);
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to navigate Chrome: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Get Chrome window bounds
 * Args: []
 * Returns: { x: number, y: number, width: number, height: number, visible: boolean }
 */
Napi::Value GetChromeBounds(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        WindowBounds bounds = GetChromeWindowBounds();
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("x", bounds.x);
        result.Set("y", bounds.y);
        result.Set("width", bounds.width);
        result.Set("height", bounds.height);
        result.Set("visible", bounds.visible);
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, std::string("Failed to get Chrome bounds: ") + e.what())
            .ThrowAsJavaScriptException();
        return env.Null();
    }
}

/**
 * Initialize the native module
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Export functions
    exports.Set(Napi::String::New(env, "launchChrome"),
                Napi::Function::New(env, LaunchChrome));
    
    exports.Set(Napi::String::New(env, "embedChrome"),
                Napi::Function::New(env, EmbedChrome));
    
    exports.Set(Napi::String::New(env, "resizeChrome"),
                Napi::Function::New(env, ResizeChrome));
    
    exports.Set(Napi::String::New(env, "closeChrome"),
                Napi::Function::New(env, CloseChrome));
    
    exports.Set(Napi::String::New(env, "navigateChrome"),
                Napi::Function::New(env, NavigateChrome));
    
    exports.Set(Napi::String::New(env, "getChromeBounds"),
                Napi::Function::New(env, GetChromeBounds));
    
    // Export platform info
    Napi::Object platform = Napi::Object::New(env);
#if defined(__APPLE__)
    platform.Set("name", "macos");
    platform.Set("windowSystem", "cocoa");
#elif defined(_WIN32)
    platform.Set("name", "windows");
    platform.Set("windowSystem", "win32");
#elif defined(__linux__)
    platform.Set("name", "linux");
    platform.Set("windowSystem", "x11");
#endif
    
    exports.Set("platform", platform);
    
    return exports;
}

NODE_API_MODULE(chrome_embed, Init)
