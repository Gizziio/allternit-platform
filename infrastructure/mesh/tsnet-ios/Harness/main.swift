import Foundation
import Mesh

// Compile/link-only harness: proves the generated xcframework is consumable
// from Swift. Do NOT run this binary — Start() would try to join a tailnet
// with no control server configured.
guard let node = MeshNewNode("harness") else {
    fatalError("MeshNewNode returned nil")
}
print("node handle:", node)
print("mesh IP before start (expected empty): '\(node.meshIP())'")
