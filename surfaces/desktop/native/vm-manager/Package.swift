// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "A2RVMManager",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "A2RVMManager",
            targets: ["A2RVMManager"]
        ),
        .executable(
            name: "vm-manager-cli",
            targets: ["VMManagerCLI"]
        )
    ],
    dependencies: [
        // No external dependencies - uses Virtualization.framework
    ],
    targets: [
        .target(
            name: "A2RVMManager",
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        ),
        .executableTarget(
            name: "VMManagerCLI",
            dependencies: ["A2RVMManager"]
        ),
        .testTarget(
            name: "A2RVMManagerTests",
            dependencies: ["A2RVMManager"]
        )
    ]
)
