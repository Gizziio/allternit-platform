// sc_capture — ScreenCaptureKit → length-prefixed JPEG frames on stdout.
//
// Usage:
//   sc_capture --check-permission
//       Prints "granted" or "denied" for Screen Recording (TCC) and exits.
//   sc_capture [--fps N] [--quality 0.0-1.0] [--scale 0.0-1.0]
//       Captures the main display and writes frames to stdout as:
//         [4-byte big-endian length][JPEG bytes]...
//       Status/errors go to stderr as single JSON lines.
//
// Protocol contract with the Node server (server/lib/capture.mjs):
//   - First stdout frame may be preceded at any time by a stderr JSON line
//     {"type":"display","width":W,"height":H} announcing the capture size.
//   - Exit code 3 = Screen Recording permission denied (TCC).

import Foundation
import ScreenCaptureKit
import CoreGraphics
import AppKit

struct Config {
    var fps: Int = 10
    var quality: CGFloat = 0.6
    var scale: CGFloat = 0.5
}

func parseArgs() -> Config? {
    var cfg = Config()
    var it = CommandLine.arguments.dropFirst().makeIterator()
    while let arg = it.next() {
        switch arg {
        case "--fps":
            guard let v = it.next(), let n = Int(v), n >= 1, n <= 60 else { return nil }
            cfg.fps = n
        case "--quality":
            guard let v = it.next(), let q = Double(v), q > 0, q <= 1 else { return nil }
            cfg.quality = CGFloat(q)
        case "--scale":
            guard let v = it.next(), let s = Double(v), s > 0, s <= 1 else { return nil }
            cfg.scale = CGFloat(s)
        default:
            return nil
        }
    }
    return cfg
}

func status(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict),
       let line = String(data: data, encoding: .utf8) {
        FileHandle.standardError.write(Data((line + "\n").utf8))
    }
}

// --check-permission: CGPreflightScreenCaptureAccess() is the authoritative
// preflight for Screen Recording on macOS 14 — it never prompts, just reports.
if CommandLine.arguments.contains("--check-permission") {
    print(CGPreflightScreenCaptureAccess() ? "granted" : "denied")
    exit(CGPreflightScreenCaptureAccess() ? 0 : 3)
}

guard let cfg = parseArgs() else {
    status(["type": "error", "error": "usage: sc_capture [--fps N] [--quality Q] [--scale S] | --check-permission"])
    exit(64)
}

guard CGPreflightScreenCaptureAccess() else {
    status(["type": "error", "error": "screen-recording-permission-denied",
            "fix": "System Settings → Privacy & Security → Screen Recording → enable the terminal app that launched this process, then restart it"])
    exit(3)
}

let out = FileHandle.standardOutput

final class FrameWriter: NSObject, SCStreamOutput {
    let quality: CGFloat
    var wroteDisplayInfo = false

    init(quality: CGFloat) { self.quality = quality }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let rep = NSBitmapImageRep(ciImage: ciImage)
        guard let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: quality]) else { return }
        if !wroteDisplayInfo {
            wroteDisplayInfo = true
            status(["type": "display", "width": rep.pixelsWide, "height": rep.pixelsHigh])
        }
        var len = UInt32(jpeg.count).bigEndian
        out.write(Data(bytes: &len, count: 4))
        out.write(jpeg)
    }
}

let semaphore = DispatchSemaphore(value: 0)

// Strong globals: SCStream does not retain its outputs, and a stopped/dead
// stream fails silently (zero frames) — keep both alive for process lifetime.
var gStream: SCStream?
var gWriter: FrameWriter?

Task {
    do {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let display = content.displays.first else {
            status(["type": "error", "error": "no-display-found"])
            exit(4)
        }
        let filter = SCContentFilter(display: display, excludingWindows: [])
        let sc = SCStreamConfiguration()
        sc.width = Int(CGFloat(display.width) * cfg.scale)
        sc.height = Int(CGFloat(display.height) * cfg.scale)
        sc.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(cfg.fps))
        sc.pixelFormat = kCVPixelFormatType_32BGRA
        sc.showsCursor = true
        sc.queueDepth = 3

        let writer = FrameWriter(quality: cfg.quality)
        let stream = SCStream(filter: filter, configuration: sc, delegate: nil)
        try stream.addStreamOutput(writer, type: .screen, sampleHandlerQueue: DispatchQueue(label: "sc_capture.frames"))
        gWriter = writer
        gStream = stream
        try await stream.startCapture()
        status(["type": "started", "fps": cfg.fps, "scale": Double(cfg.scale),
                "captureWidth": sc.width, "captureHeight": sc.height])
    } catch {
        status(["type": "error", "error": String(describing: error)])
        exit(5)
    }
    semaphore.signal()
}

semaphore.wait()
RunLoop.main.run()
