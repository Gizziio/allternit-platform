import CoreGraphics
import Foundation
import zlib

// -----------------------------------------------------------------------------
// Framebuffer + rectangle decoders for the RFB client: applies Raw, CopyRect
// and ZRLE rectangles to a BGRA pixel buffer and snapshots CGImages.
//
// The pixel format is the one the client negotiates in
// `RFBClientMessage.setPixelFormat()` (32 bpp, depth 24, little-endian,
// shifts R16/G8/B0): wire pixels arrive as [B, G, R, pad], matching the
// buffer's byteOrder32Little/noneSkipFirst layout byte-for-byte.
//
// ZRLE note (RFB 3.8 §7.7.2 / TightVNC ext): the zlib stream is PERSISTENT
// across rectangles — each rectangle's payload is the next segment of one
// continuous stream. libz (`import zlib`, part of the iOS SDK) is used
// instead of the Compression framework because COMPRESSION_ZLIB expects raw
// RFC 1951 deflate, while RFB ZRLE uses the zlib (RFC 1950) wrapper. The
// `z_stream` lives in `ZRLEInflater` for the life of the connection, and
// compressed input it hasn't consumed yet is carried into the next
// rectangle's decode.
// -----------------------------------------------------------------------------

/// One persistent RFC 1950 (zlib-wrapped) inflate stream shared by every
/// ZRLE rectangle of the connection.
final class ZRLEInflater {
    private var stream = z_stream()
    private var isInitialized = false
    /// Compressed bytes inflate() has been offered but not yet consumed —
    /// they belong to the NEXT rectangle's segment of the stream.
    private var pendingInput = Data()

    deinit {
        if isInitialized {
            inflateEnd(&stream)
        }
    }

    /// Queues one rectangle's compressed segment.
    func feed(_ compressed: Data) {
        pendingInput.append(compressed)
    }

    /// Inflates exactly `count` decompressed bytes, throwing on stream
    /// errors or when the fed data runs out mid-read (a corrupt stream —
    /// never rendered partially).
    func read(_ count: Int) throws -> [UInt8] {
        if count == 0 { return [] }
        try ensureInitialized()
        var output = [UInt8](repeating: 0, count: count)
        var produced = 0
        while produced < count {
            guard !pendingInput.isEmpty else { throw RFBError.zrleUnderflow }
            var consumed = 0
            var status: Int32 = Z_OK
            pendingInput.withUnsafeBytes { inRaw in
                guard let inBase = inRaw.baseAddress else { return }
                output.withUnsafeMutableBytes { outRaw in
                    guard let outBase = outRaw.baseAddress else { return }
                    stream.next_in = UnsafeMutablePointer<Bytef>(mutating: inBase.assumingMemoryBound(to: Bytef.self))
                    stream.avail_in = uInt(inRaw.count)
                    stream.next_out = outBase.advanced(by: produced).assumingMemoryBound(to: Bytef.self)
                    stream.avail_out = uInt(count - produced)
                    status = inflate(&stream, Z_NO_FLUSH)
                    consumed = inRaw.count - Int(stream.avail_in)
                    produced = count - Int(stream.avail_out)
                }
            }
            pendingInput.removeFirst(consumed)
            guard status == Z_OK || status == Z_STREAM_END else {
                throw RFBError.zrleInflateFailed(status)
            }
            if consumed == 0 && produced < count && pendingInput.isEmpty {
                // inflate made no progress and there is nothing left to
                // feed it — the stream is truncated.
                throw RFBError.zrleUnderflow
            }
        }
        return output
    }

    private func ensureInitialized() throws {
        guard !isInitialized else { return }
        let status = inflateInit_(&stream, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
        guard status == Z_OK else { throw RFBError.zrleInflateFailed(status) }
        isInitialized = true
    }
}

/// The negotiated framebuffer: a width×height BGRA pixel buffer wrapped by a
/// CGContext, so a CGImage snapshot is one `makeImage()` call after each
/// FramebufferUpdate batch.
final class RFBFramebuffer {
    let width: Int
    let height: Int
    private let bytesPerRow: Int
    private let pixels: UnsafeMutablePointer<UInt8>
    private let context: CGContext
    /// Persistent across rectangles per the ZRLE spec — see the file header.
    private let inflater = ZRLEInflater()

    init(width: Int, height: Int) throws {
        // 8K ceiling: protects the allocation from a garbage ServerInit.
        guard width > 0, height > 0, width <= 8192, height <= 8192 else {
            throw RFBError.invalidFramebufferSize(width, height)
        }
        self.width = width
        self.height = height
        bytesPerRow = width * 4
        pixels = UnsafeMutablePointer<UInt8>.allocate(capacity: bytesPerRow * height)
        pixels.initialize(repeating: 0, count: bytesPerRow * height)
        // byteOrder32Little + noneSkipFirst = B,G,R,X bytes in memory — the
        // exact order the negotiated pixel format puts on the wire.
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipFirst.rawValue
                                      | CGBitmapInfo.byteOrder32Little.rawValue)
        guard let context = CGContext(
            data: pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: bitmapInfo.rawValue
        ) else {
            pixels.deallocate()
            throw RFBError.invalidFramebufferSize(width, height)
        }
        self.context = context
    }

    deinit {
        pixels.deallocate()
    }

    /// Snapshot of the current buffer (CGContext.makeImage() copies the
    /// backing store, so later rectangle writes never mutate a published
    /// frame).
    func makeImage() -> CGImage? {
        context.makeImage()
    }

    /// Applies one rectangle of a FramebufferUpdate. Encoding dispatch is
    /// total — anything outside Raw/CopyRect/ZRLE throws (the parser already
    /// rejects unrequested encodings; this is the second fence).
    func apply(_ rect: RFBRectangle) throws {
        let x = Int(rect.x), y = Int(rect.y)
        let width = Int(rect.width), height = Int(rect.height)
        guard x >= 0, y >= 0, width >= 0, height >= 0,
              x + width <= self.width, y + height <= self.height else {
            throw RFBError.rectangleOutOfBounds
        }
        guard width > 0, height > 0 else { return }
        switch rect.encoding {
        case RFBEncoding.raw:
            try applyRaw(rect, x: x, y: y, width: width, height: height)
        case RFBEncoding.copyRect:
            try applyCopyRect(rect, x: x, y: y, width: width, height: height)
        case RFBEncoding.zrle:
            try applyZRLE(rect, x: x, y: y, width: width, height: height)
        default:
            throw RFBError.unsupportedEncoding(rect.encoding)
        }
    }

    // MARK: - Raw (encoding 0)

    /// Raw pixels in the negotiated format: [B, G, R, pad] per pixel — a
    /// straight row copy into the buffer (the pad byte is never rendered,
    /// noneSkipFirst).
    private func applyRaw(_ rect: RFBRectangle, x: Int, y: Int, width: Int, height: Int) throws {
        guard rect.payload.count == width * height * 4 else {
            throw RFBError.malformedRectanglePayload
        }
        rect.payload.withUnsafeBytes { raw in
            guard let base = raw.baseAddress else { return }
            let source = base.assumingMemoryBound(to: UInt8.self)
            for row in 0..<height {
                memcpy(
                    pixels + (y + row) * bytesPerRow + x * 4,
                    source + row * width * 4,
                    width * 4
                )
            }
        }
    }

    // MARK: - CopyRect (encoding 1)

    /// Payload is src-x/src-y (u16 each); the rectangle is moved within the
    /// existing buffer. Source and destination may overlap (scrolls), so the
    /// block is staged through a temporary copy before being written.
    private func applyCopyRect(_ rect: RFBRectangle, x: Int, y: Int, width: Int, height: Int) throws {
        guard rect.payload.count == 4 else { throw RFBError.malformedRectanglePayload }
        let sourceX = Int(UInt16(rect.payload[rect.payload.startIndex]) << 8
                          | UInt16(rect.payload[rect.payload.startIndex + 1]))
        let sourceY = Int(UInt16(rect.payload[rect.payload.startIndex + 2]) << 8
                          | UInt16(rect.payload[rect.payload.startIndex + 3]))
        guard sourceX + width <= self.width, sourceY + height <= self.height else {
            throw RFBError.rectangleOutOfBounds
        }
        var staging = [UInt8](repeating: 0, count: width * height * 4)
        staging.withUnsafeMutableBytes { stagingRaw in
            let stagingBase = stagingRaw.baseAddress!
            for row in 0..<height {
                memcpy(
                    stagingBase + row * width * 4,
                    pixels + (sourceY + row) * bytesPerRow + sourceX * 4,
                    width * 4
                )
            }
            for row in 0..<height {
                memcpy(
                    pixels + (y + row) * bytesPerRow + x * 4,
                    stagingBase + row * width * 4,
                    width * 4
                )
            }
        }
    }

    // MARK: - ZRLE (encoding 16)

    /// The payload is this rectangle's segment of the persistent zlib
    /// stream. Decompressed, it is a sequence of ≤64×64 tiles in reading
    /// order (rows of tiles top→bottom, tiles left→right).
    private func applyZRLE(_ rect: RFBRectangle, x: Int, y: Int, width: Int, height: Int) throws {
        inflater.feed(rect.payload)
        var tileY = 0
        while tileY < height {
            var tileX = 0
            let tileHeight = min(64, height - tileY)
            while tileX < width {
                let tileWidth = min(64, width - tileX)
                try decodeZRLERect(
                    x: x + tileX, y: y + tileY,
                    width: tileWidth, height: tileHeight
                )
                tileX += tileWidth
            }
            tileY += tileHeight
        }
    }

    /// One ZRLE tile. CPIXELs are 3 bytes, least-significant first
    /// (big-endian-flag 0) → [B, G, R] under the negotiated shifts.
    private func decodeZRLERect(x: Int, y: Int, width: Int, height: Int) throws {
        let subencoding = try inflater.read(1)[0]
        switch subencoding {
        case 0:
            // Raw CPIXELs.
            let bytes = try inflater.read(width * height * 3)
            var cursor = 0
            for row in 0..<height {
                for column in 0..<width {
                    writePixel(x: x + column, y: y + row,
                               blue: bytes[cursor], green: bytes[cursor + 1], red: bytes[cursor + 2])
                    cursor += 3
                }
            }
        case 1:
            // Solid tile: a single CPIXEL.
            let bytes = try inflater.read(3)
            for row in 0..<height {
                for column in 0..<width {
                    writePixel(x: x + column, y: y + row,
                               blue: bytes[0], green: bytes[1], red: bytes[2])
                }
            }
        case 2...16:
            // Packed palette: `subencoding` palette CPIXELs, then indices
            // packed MSB-first at 1/2/4 bits, rows padded to whole bytes.
            let palette = try readPalette(count: Int(subencoding))
            let bitsPerIndex = subencoding <= 2 ? 1 : (subencoding <= 4 ? 2 : 4)
            let bytesPerPackedRow = (width * bitsPerIndex + 7) / 8
            let packed = try inflater.read(bytesPerPackedRow * height)
            for row in 0..<height {
                for column in 0..<width {
                    let bitOffset = row * bytesPerPackedRow * 8 + column * bitsPerIndex
                    let byte = packed[bitOffset / 8]
                    let shift = 8 - bitsPerIndex - (bitOffset % 8)
                    let index = Int(byte >> UInt8(shift)) & ((1 << bitsPerIndex) - 1)
                    let color = palette[index]
                    writePixel(x: x + column, y: y + row,
                               blue: color.0, green: color.1, red: color.2)
                }
            }
        case 17...127:
            throw RFBError.invalidZRLESubencoding(subencoding)
        case 128:
            // Plain RLE: (CPIXEL, run-length) pairs; a length byte of 255
            // continues the run into the next byte.
            var pixel = 0
            let total = width * height
            while pixel < total {
                let bytes = try inflater.read(3)
                let runLength = try readRLERunLength()
                guard pixel + runLength <= total else { throw RFBError.malformedZRLETile }
                for _ in 0..<runLength {
                    writePixel(x: x + pixel % width, y: y + pixel / width,
                               blue: bytes[0], green: bytes[1], red: bytes[2])
                    pixel += 1
                }
            }
        case 129:
            // Palette RLE: u8 palette size + palette, then bytes — high bit
            // set means a run of the low-7-bit index followed by a run
            // length; clear means a single pixel of that index.
            let paletteCount = Int(try inflater.read(1)[0])
            let palette = try readPalette(count: paletteCount)
            var pixel = 0
            let total = width * height
            while pixel < total {
                let head = try inflater.read(1)[0]
                let index = Int(head & 0x7F)
                guard index < palette.count else { throw RFBError.malformedZRLETile }
                let color = palette[index]
                let runLength = head & 0x80 != 0 ? try readRLERunLength() : 1
                guard pixel + runLength <= total else { throw RFBError.malformedZRLETile }
                for _ in 0..<runLength {
                    writePixel(x: x + pixel % width, y: y + pixel / width,
                               blue: color.0, green: color.1, red: color.2)
                    pixel += 1
                }
            }
        default:
            // 130...255 (Swift can't prove range-pattern exhaustiveness).
            throw RFBError.invalidZRLESubencoding(subencoding)
        }
    }

    /// ZRLE run length: consecutive length bytes sum, and a byte of 255
    /// means the run continues into the next byte.
    private func readRLERunLength() throws -> Int {
        var length = 0
        while true {
            let byte = Int(try inflater.read(1)[0])
            length += byte
            if byte != 255 { return length }
        }
    }

    private func readPalette(count: Int) throws -> [(UInt8, UInt8, UInt8)] {
        guard count > 0 else { throw RFBError.malformedZRLETile }
        let bytes = try inflater.read(count * 3)
        var palette: [(UInt8, UInt8, UInt8)] = []
        palette.reserveCapacity(count)
        for index in 0..<count {
            palette.append((bytes[index * 3], bytes[index * 3 + 1], bytes[index * 3 + 2]))
        }
        return palette
    }

    /// Writes one BGRA pixel (alpha pinned to 255 — ignored by the context's
    /// noneSkipFirst either way).
    private func writePixel(x: Int, y: Int, blue: UInt8, green: UInt8, red: UInt8) {
        let offset = y * bytesPerRow + x * 4
        pixels[offset] = blue
        pixels[offset + 1] = green
        pixels[offset + 2] = red
        pixels[offset + 3] = 255
    }
}
