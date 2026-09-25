// resize_jpeg.swift — downscale a JPEG file, atomically.
// usage: resize_jpeg <in.jpg> <out.jpg> <maxWidth> <quality 0-100>
// Exists because sips orphans one UUID-named intermediate per invocation in
// the per-user temp root — unusable in a per-frame loop. Reads and writes
// only the two paths it is given; no temp files, no TCC prompts.
import Foundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 5,
      let maxWidth = Double(args[3]),
      let quality = Double(args[4]),
      let src = NSImage(contentsOfFile: args[1]) else {
    FileHandle.standardError.write("usage: resize_jpeg <in> <out> <maxWidth> <quality>\n".data(using: .utf8)!)
    exit(2)
}

let size = src.size
let scale = min(1.0, maxWidth / size.width)
let outSize = NSSize(width: round(size.width * scale), height: round(size.height * scale))

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(outSize.width), pixelsHigh: Int(outSize.height),
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .calibratedRGB, bytesPerRow: 0, bitsPerPixel: 0
) else { exit(3) }

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
src.draw(in: NSRect(origin: .zero, size: outSize), from: .zero, operation: .sourceOver, fraction: 1)
NSGraphicsContext.restoreGraphicsState()

guard let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: Float(quality / 100)]) else { exit(4) }
do {
    try jpeg.write(to: URL(fileURLWithPath: args[2]), options: .atomic)
} catch {
    FileHandle.standardError.write("resize_jpeg: write: \(error.localizedDescription)\n".data(using: .utf8)!)
    exit(5)
}
