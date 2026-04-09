{
  "targets": [
    {
      "target_name": "chrome_embed",
      "sources": [
        "src/platform/mac/chrome_embed_mac.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "11.0",
        "OTHER_CPLUSPLUSFLAGS": [ "-fobjc-arc" ],
        "FRAMEWORKS": [
          "Cocoa",
          "AppKit",
          "Foundation",
          "ApplicationServices"
        ]
      }
    }
  ]
}
