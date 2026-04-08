// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AllternitVMManager",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "AllternitVMManager",
            targets: ["AllternitVMManager"]
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
            name: "AllternitVMManager",
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        ),
        .executableTarget(
            name: "VMManagerCLI",
            dependencies: ["AllternitVMManager"]
        ),
        .testTarget(
            name: "AllternitVMManagerTests",
            dependencies: ["AllternitVMManager"]
        )
    ]
)
