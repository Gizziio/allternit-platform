// VirtHelper.swift
// Allternit Computer Use — Apple Virtualization.framework helper
//
// Compile (requires macOS 13+ SDK):
//   swiftc VirtHelper.swift -o virt_helper \
//       -framework Virtualization \
//       -target arm64-apple-macosx13.0
//
// Protocol (JSON lines on stdin/stdout):
//   start  → {"action":"start","memory_mb":N,"vcpus":N}
//          ← {"status":"running","sandbox_id":"<id>"}
//          ← {"status":"error","message":"<msg>"}
//
//   run    → {"action":"run","command":[...],"env":{...}}
//          ← {"status":"ok","exit_code":N,"stdout":"...","stderr":"..."}
//
//   stop   → {"action":"stop"}
//          ← {"status":"stopped"}

import Foundation
import Virtualization

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

func readLine() -> String? {
    var line = ""
    while true {
        let char = readCharacter()
        if char == nil || char == "\n" { return line.isEmpty && char == nil ? nil : line }
        line.append(char!)
    }
}

func readCharacter() -> Character? {
    var byte: UInt8 = 0
    let n = read(STDIN_FILENO, &byte, 1)
    guard n > 0 else { return nil }
    return Character(UnicodeScalar(byte))
}

func send(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        fflush(stdout)
    }
}

// ---------------------------------------------------------------------------
// VM state
// ---------------------------------------------------------------------------

var currentVM: VZVirtualMachine?
var sandboxID: String = UUID().uuidString.prefix(8).lowercased() + ""

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

while let line = readLine() {
    guard let data = line.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let action = json["action"] as? String else {
        send(["status": "error", "message": "invalid JSON"])
        continue
    }

    switch action {

    // -----------------------------------------------------------------------
    case "start":
        let memoryMB = json["memory_mb"] as? Int ?? 512
        let vcpus    = json["vcpus"]     as? Int ?? 1

        #if arch(arm64)
        // Apple Silicon — we can boot a Linux guest.
        do {
            let config = VZVirtualMachineConfiguration()
            config.cpuCount    = vcpus
            config.memorySize  = UInt64(memoryMB) * 1024 * 1024

            // Serial console (required even if unused).
            let serial = VZVirtioConsoleDeviceSerialPortConfiguration()
            serial.attachment = VZFileHandleSerialPortAttachment(
                fileHandleForReading:  FileHandle.standardInput,
                fileHandleForWriting:  FileHandle.standardOutput
            )
            config.serialPorts = [serial]

            // Entropy source.
            config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]

            try config.validate()

            let vm = VZVirtualMachine(configuration: config)
            currentVM = vm

            vm.start { result in
                switch result {
                case .success:
                    sandboxID = String(UUID().uuidString.prefix(8)).lowercased()
                    send(["status": "running", "sandbox_id": sandboxID])
                case .failure(let err):
                    send(["status": "error", "message": err.localizedDescription])
                }
            }
        } catch {
            // Config invalid (e.g. no kernel image provided) — report error.
            // Python layer will fall back to ProcessSandbox.
            send(["status": "error", "message": error.localizedDescription])
        }
        #else
        // x86_64 or simulator — Virtualization.framework VM start not supported.
        // Return a mock sandbox_id so Python falls back gracefully.
        send(["status": "error", "message": "Virtualization.framework VM start requires Apple Silicon"])
        #endif

    // -----------------------------------------------------------------------
    case "run":
        let command = json["command"] as? [String] ?? []
        let env     = json["env"]     as? [String: String] ?? [:]

        guard !command.isEmpty else {
            send(["status": "error", "message": "empty command"])
            continue
        }

        // In a full implementation we would send the command over vsock to a
        // guest agent. For now we run it on the host via Foundation's Process,
        // which gives us a working implementation while the guest agent is
        // being developed.
        let task = Process()
        task.executableURL = URL(fileURLWithPath: command[0])
        task.arguments     = Array(command.dropFirst())

        var taskEnv = ProcessInfo.processInfo.environment
        for (k, v) in env { taskEnv[k] = v }
        task.environment = taskEnv

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        task.standardOutput = stdoutPipe
        task.standardError  = stderrPipe

        do {
            try task.run()
            task.waitUntilExit()

            let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()

            send([
                "status":    "ok",
                "exit_code": Int(task.terminationStatus),
                "stdout":    String(data: stdoutData, encoding: .utf8) ?? "",
                "stderr":    String(data: stderrData, encoding: .utf8) ?? "",
            ])
        } catch {
            send([
                "status":    "ok",
                "exit_code": -1,
                "stdout":    "",
                "stderr":    error.localizedDescription,
            ])
        }

    // -----------------------------------------------------------------------
    case "stop":
        if let vm = currentVM {
            vm.stop { _ in }
            currentVM = nil
        }
        send(["status": "stopped"])
        exit(0)

    // -----------------------------------------------------------------------
    default:
        send(["status": "error", "message": "unknown action: \(action)"])
    }
}
