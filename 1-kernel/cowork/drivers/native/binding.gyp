{
  "targets": [
    {
      "target_name": "apple-vf-native",
      "sources": [
        "apple-vf-native.mm"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": [
        "-fno-exceptions"
      ],
      "cflags_cc!": [
        "-fno-exceptions"
      ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "11.0",
        "OTHER_CPLUSPLUSFLAGS": [
          "-std=c++17",
          "-stdlib=libc++"
        ],
        "OTHER_LDFLAGS": [
          "-framework Virtualization",
          "-framework Foundation"
        ]
      },
      "conditions": [
        [
          "OS=='mac'",
          {
            "link_settings": {
              "libraries": [
                "-framework Virtualization",
                "-framework Foundation"
              ]
            },
            "xcode_settings": {
              "OTHER_LDFLAGS": [
                "-Wl,-rpath,/System/Library/Frameworks",
                "-framework Virtualization",
                "-framework Foundation"
              ]
            }
          }
        ]
      ]
    }
  ]
}
