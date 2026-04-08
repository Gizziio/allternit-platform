#import <Cocoa/Cocoa.h>
#import <node_api.h>
#import <node_addon_api.h>

static NSWindow* chromeWindow = nil;
static NSView* containerView = nil;

// Launch Chrome and embed its window
napi_value LaunchChrome(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    char url[2048];
    napi_get_value_string_utf8(env, args[0], url, sizeof(url));
    
    // Launch Chrome with app mode (no browser UI)
    NSString* chromePath = @"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    NSString* chromeUrl = [NSString stringWithUTF8String:url];
    
    NSArray* args = @[
        chromePath,
        @"--app=" + chromeUrl,
        @"--no-first-run",
        @"--disable-features=ChromeWhatsNewUI",
        @"--remote-debugging-port=9222"
    ];
    
    NSTask* task = [[NSTask alloc] init];
    task.launchPath = chromePath;
    task.arguments = [args subarrayWithRange:NSMakeRange(1, args.count - 1)];
    [task launch];
    
    // Wait for Chrome window to appear
    [NSThread sleepForTimeInterval:2.0];
    
    // Find Chrome's window
    NSRunningApplication* chromeApp = [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.google.Chrome"].firstObject;
    if (!chromeApp) {
        napi_value result;
        napi_create_string_utf8(env, "Chrome not found", NAPI_AUTO_LENGTH, &result);
        return result;
    }
    
    // Get Chrome's main window
    NSArray* windows = [NSWindow windowNumbersWithOptions:NSWindowListOptionIncludingHidden];
    NSNumber* chromePid = @(chromeApp.processIdentifier);
    
    for (NSNumber* windowNumber in windows) {
        NSDictionary* info = [NSWindow windowInformationWithWindowNumber:windowNumber.number options:0];
        if ([info[@"kCGWindowOwnerPID"] isEqual:chromePid]) {
            // Found Chrome window
            chromeWindow = [NSWindow windowWithWindowNumber:windowNumber.intValue];
            break;
        }
    }
    
    napi_value result;
    napi_create_string_utf8(env, "Chrome launched", NAPI_AUTO_LENGTH, &result);
    return result;
}

// Embed Chrome window into container view
napi_value EmbedChrome(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    int64_t containerHandle;
    napi_get_value_int64(env, args[0], &containerHandle);
    
    // Get the container NSView from handle
    containerView = (__bridge NSView*)(void*)containerHandle;
    
    if (chromeWindow && containerView) {
        // Remove Chrome window from its parent
        [chromeWindow setContentView:nil];
        
        // Set Chrome window's parent to our container
        [containerView addSubview:chromeWindow.contentView];
        
        // Resize to fit container
        chromeWindow.contentView.frame = containerView.bounds;
    }
    
    napi_value result;
    napi_create_string_utf8(env, "Embedded", NAPI_AUTO_LENGTH, &result);
    return result;
}

// Resize embedded Chrome window
napi_value ResizeChrome(napi_env env, napi_callback_info info) {
    size_t argc = 4;
    napi_value args[4];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    
    int64_t x, y, width, height;
    napi_get_value_int64(env, args[0], &x);
    napi_get_value_int64(env, args[1], &y);
    napi_get_value_int64(env, args[2], &width);
    napi_get_value_int64(env, args[3], &height);
    
    if (chromeWindow && chromeWindow.contentView) {
        chromeWindow.contentView.frame = NSMakeRect(x, y, width, height);
    }
    
    napi_value result;
    napi_create_string_utf8(env, "Resized", NAPI_AUTO_LENGTH, &result);
    return result;
}

// Close embedded Chrome
napi_value CloseChrome(napi_env env, napi_callback_info info) {
    if (chromeWindow) {
        [chromeWindow close];
        chromeWindow = nil;
    }
    
    napi_value result;
    napi_create_string_utf8(env, "Closed", NAPI_AUTO_LENGTH, &result);
    return result;
}

// Initialize module
napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor props[] = {
        { "launchChrome", nullptr, LaunchChrome, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "embedChrome", nullptr, EmbedChrome, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "resizeChrome", nullptr, ResizeChrome, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "closeChrome", nullptr, CloseChrome, nullptr, nullptr, nullptr, napi_default, nullptr }
    };
    
    napi_define_properties(env, exports, sizeof(props) / sizeof(props[0]), props);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
