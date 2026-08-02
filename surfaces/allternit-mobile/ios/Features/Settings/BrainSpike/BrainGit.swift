#if DEBUG
//
// D3 SPIKE — embedded git client proof. DEBUG builds only (whole file is
// compile-gated like the `-skip-auth` shim in AllternitApp.swift). Wraps the
// vendored libgit2.xcframework (module `Clibgit2`) with just enough surface
// for the Brain Spike screen: clone → append frontmatter page → commit →
// push, over HTTP(S)+Basic and file://. NOT production code — D3's real
// client should take this shape but with proper error types and no
// force-unwrapped defaults.
//

import Foundation
import Clibgit2

/// Box passed as the payload to the libgit2 credentials C callback — C
/// function pointers can't capture, so the credentials travel as an opaque
/// pointer alongside the callback.
private final class CredentialBox {
    let username: String
    let password: String
    init(username: String, password: String) {
        self.username = username
        self.password = password
    }
}

/// libgit2 credentials callback: HTTP Basic (userpass plaintext — how an
/// `allternit_git_` token rides the smart-HTTP protocol). Rejects every
/// other credential type; file:// never triggers the callback at all.
private let acquireCredentials: git_credential_acquire_cb = { out, _, _, allowed, payload in
    guard allowed & UInt32(GIT_CREDENTIAL_USERPASS_PLAINTEXT.rawValue) != 0,
          let payload = payload else { return -1 }
    let box = Unmanaged<CredentialBox>.fromOpaque(payload).takeUnretainedValue()
    return git_credential_userpass_plaintext_new(out, box.username, box.password)
}

/// One leg of the spike proof (file round trip, HTTP+Basic round trip, …),
/// recorded into the JSON result file for the report.
struct BrainSpikeLegResult: Codable {
    var attempted: Bool
    var ok: Bool
    var detail: String
}

/// Written to <Documents>/brain-spike-result.json by `-brain-spike-auto` so
/// the harness (simctl) can read the verdict without screenshot parsing.
struct BrainSpikeResult: Codable {
    var startedAt: String
    var libgit2Version: String
    var fileRoundTrip: BrainSpikeLegResult
    var httpBasicRoundTrip: BrainSpikeLegResult
    var httpsPublicClone: BrainSpikeLegResult
    var log: [String]
}

/// `@unchecked Sendable`: libgit2 work is serialized on `queue`, and all
/// published-state mutations hop to the main queue — safe for the spike's
/// `Task { await git.… }` call sites under Swift 6 checking.
final class BrainGit: ObservableObject, @unchecked Sendable {
    @Published private(set) var log: [String] = []
    @Published private(set) var running = false

    /// Serial queue for all libgit2 calls — libgit2 is thread-aware but the
    /// spike keeps it simple: one operation at a time, off the main thread.
    private let queue = DispatchQueue(label: "com.allternit.brain-spike.git")

    init() {
        git_libgit2_init()
    }

    static var libgit2Version: String {
        var major: Int32 = 0, minor: Int32 = 0, rev: Int32 = 0
        git_libgit2_version(&major, &minor, &rev)
        return "\(major).\(minor).\(rev)"
    }

    var libgit2Version: String { Self.libgit2Version }

    func clearLog() { log.removeAll() }

    private func logLine(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            self?.log.append(message)
        }
    }

    private func lastGitError(_ fallback: String) -> String {
        if let err = git_error_last(), let message = err.pointee.message {
            return String(cString: message)
        }
        return fallback
    }

    private func offMain<T>(_ work: @escaping @Sendable () -> T) async -> T {
        await withCheckedContinuation { cont in
            queue.async { cont.resume(returning: work()) }
        }
    }

    private func setRunning(_ value: Bool) {
        DispatchQueue.main.async { [weak self] in self?.running = value }
    }

    // MARK: - Operations

    /// Clone `url` into `dir` (wiped first). Empty username/token = anonymous
    /// (public clone or file://); otherwise HTTP Basic.
    func clone(url: String, to dir: URL, username: String = "", token: String = "") async -> Bool {
        setRunning(true)
        defer { setRunning(false) }
        return await offMain { [self] in
            logLine("→ clone \(url.isEmpty ? "(none)" : url)")
            try? FileManager.default.removeItem(at: dir)
            var repo: OpaquePointer? = nil
            var options = git_clone_options()
            git_clone_options_init(&options, UInt32(GIT_CLONE_OPTIONS_VERSION))
            let box = CredentialBox(username: username, password: token)
            options.fetch_opts.callbacks.credentials = acquireCredentials
            options.fetch_opts.callbacks.payload = Unmanaged.passUnretained(box).toOpaque()
            let rc = withExtendedLifetime(box) {
                url.withCString { cURL in
                    dir.path.withCString { cPath in
                        git_clone(&repo, cURL, cPath, &options)
                    }
                }
            }
            guard rc == 0, let repo = repo else {
                logLine("✗ clone failed: \(lastGitError("git_clone rc=\(rc)"))")
                return false
            }
            var head: OpaquePointer? = nil
            var headDesc = "(unborn)"
            if git_repository_head(&head, repo) == 0, let head = head,
               let name = git_reference_name(head) {
                headDesc = String(cString: name)
                git_reference_free(head)
            }
            git_repository_free(repo)
            logLine("✓ cloned — HEAD: \(headDesc)")
            return true
        }
    }

    /// Append `pages/spike-<timestamp>.md` (YAML frontmatter + body) to the
    /// repo at `dir`, stage it, and commit on the current branch.
    /// Returns the commit subject on success.
    func appendPageAndCommit(dir: URL) async -> String? {
        setRunning(true)
        defer { setRunning(false) }
        return await offMain { [self] () -> String? in
            var repo: OpaquePointer? = nil
            guard git_repository_open(&repo, dir.path) == 0, let repo = repo else {
                logLine("✗ open repo failed: \(lastGitError("git_repository_open"))")
                return nil
            }
            defer { git_repository_free(repo) }

            let stamp = ISO8601DateFormatter().string(from: Date())
                .replacingOccurrences(of: ":", with: "-")
            let relativePath = "pages/spike-\(stamp).md"
            let body = """
            ---
            title: "Brain Spike page"
            created: "\(ISO8601DateFormatter().string(from: Date()))"
            source: "ios-brain-spike"
            ---

            # Brain Spike

            Written by the D3 spike screen (embedded libgit2) to prove
            clone → append → commit → push from inside the iOS app.
            """
            let fileURL = dir.appendingPathComponent(relativePath)
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true)
                try body.write(to: fileURL, atomically: true, encoding: .utf8)
            } catch {
                logLine("✗ write page failed: \(error.localizedDescription)")
                return nil
            }

            var index: OpaquePointer? = nil
            guard git_repository_index(&index, repo) == 0, let index = index else {
                logLine("✗ index failed: \(lastGitError("git_repository_index"))")
                return nil
            }
            defer { git_index_free(index) }
            guard git_index_add_bypath(index, relativePath) == 0,
                  git_index_write(index) == 0 else {
                logLine("✗ stage failed: \(lastGitError("git_index_add_bypath"))")
                return nil
            }

            var treeOID = git_oid()
            var tree: OpaquePointer? = nil
            guard git_index_write_tree(&treeOID, index) == 0,
                  git_tree_lookup(&tree, repo, &treeOID) == 0, let tree = tree else {
                logLine("✗ write tree failed: \(lastGitError("git_index_write_tree"))")
                return nil
            }
            defer { git_tree_free(tree) }

            // First commit has no parent (fresh/empty clone); later commits
            // parent on HEAD.
            var parents: [OpaquePointer?] = []
            var parentOID = git_oid()
            var parent: OpaquePointer? = nil
            if git_reference_name_to_id(&parentOID, repo, "HEAD") == 0,
               git_commit_lookup(&parent, repo, &parentOID) == 0 {
                parents = [parent]
            }
            defer { if let parent = parent { git_commit_free(parent) } }

            var signature: UnsafeMutablePointer<git_signature>? = nil
            guard git_signature_now(&signature, "Brain Spike", "brain-spike@allternit.local") == 0 else {
                logLine("✗ signature failed: \(lastGitError("git_signature_now"))")
                return nil
            }
            defer { git_signature_free(signature) }

            let subject = "spike: append \(relativePath)"
            var commitOID = git_oid()
            var mutableParents = parents
            let rc = mutableParents.withUnsafeMutableBufferPointer { buffer in
                git_commit_create(
                    &commitOID, repo, "HEAD",
                    signature, signature, nil, subject, tree,
                    parents.count, buffer.baseAddress)
            }
            guard rc == 0 else {
                logLine("✗ commit failed: \(lastGitError("git_commit_create"))")
                return nil
            }
            var short = [CChar](repeating: 0, count: 8)
            git_oid_tostr(&short, 8, &commitOID)
            logLine("✓ committed \(String(cString: short)) — \(subject)")
            return subject
        }
    }

    /// Push the current branch to `origin`. Reuses the same Basic
    /// credentials as clone; no-op credential callback for file://.
    func push(dir: URL, username: String = "", token: String = "") async -> Bool {
        setRunning(true)
        defer { setRunning(false) }
        return await offMain { [self] in
            var repo: OpaquePointer? = nil
            guard git_repository_open(&repo, dir.path) == 0, let repo = repo else {
                logLine("✗ open repo failed: \(lastGitError("git_repository_open"))")
                return false
            }
            defer { git_repository_free(repo) }

            var head: OpaquePointer? = nil
            guard git_repository_head(&head, repo) == 0, let head = head,
                  let refName = git_reference_name(head) else {
                logLine("✗ HEAD unreadable: \(lastGitError("git_repository_head"))")
                return false
            }
            let branch = String(cString: refName)
                .replacingOccurrences(of: "refs/heads/", with: "")
            git_reference_free(head)

            var remote: OpaquePointer? = nil
            guard git_remote_lookup(&remote, repo, "origin") == 0, let remote = remote else {
                logLine("✗ no origin remote: \(lastGitError("git_remote_lookup"))")
                return false
            }
            defer { git_remote_free(remote) }

            var options = git_push_options()
            git_push_options_init(&options, UInt32(GIT_PUSH_OPTIONS_VERSION))
            let box = CredentialBox(username: username, password: token)
            options.callbacks.credentials = acquireCredentials
            options.callbacks.payload = Unmanaged.passUnretained(box).toOpaque()

            let refspec = "refs/heads/\(branch):refs/heads/\(branch)"
            logLine("→ push \(refspec)")
            var spec = strdup(refspec)
            var refspecs = git_strarray(strings: &spec, count: 1)
            let rc = withExtendedLifetime(box) {
                git_remote_push(remote, &refspecs, &options)
            }
            free(spec)
            guard rc == 0 else {
                logLine("✗ push failed: \(lastGitError("git_remote_push rc=\(rc)"))")
                return false
            }
            logLine("✓ pushed \(branch) → origin")
            return true
        }
    }

    // MARK: - Full round trip (`-brain-spike-auto`)

    /// The whole proof in one shot: file:// round trip (bare repo inside the
    /// app container), HTTP+Basic round trip against `httpURL` with the
    /// `allternit_git_` token, and a public HTTPS clone (TLS signal). Writes
    /// <Documents>/brain-spike-result.json at the end.
    @MainActor
    func runFullProof(httpURL: String, username: String, token: String) async {
        clearLog()
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        logLine("libgit2 \(libgit2Version) — starting full proof")

        // Leg 1: file:// offline round trip. The bare repo lives in the app
        // container so the simulator sandbox is a non-issue.
        let bareDir = docs.appendingPathComponent("brain-spike/bare.git")
        let fileCloneDir = docs.appendingPathComponent("brain-spike/file-clone")
        try? FileManager.default.removeItem(at: bareDir.deletingLastPathComponent())
        var fileLeg = BrainSpikeLegResult(attempted: true, ok: false, detail: "")
        do {
            try FileManager.default.createDirectory(at: bareDir, withIntermediateDirectories: true)
            let initialized = await offMain { () -> Bool in
                var bare: OpaquePointer? = nil
                let rc = git_repository_init(&bare, bareDir.path, 1)
                if let bare = bare { git_repository_free(bare) }
                return rc == 0
            }
            guard initialized else { throw SpikeError.step("git_repository_init bare") }
            logLine("✓ bare repo init (file:// leg): \(bareDir.path)")
            guard await clone(url: bareDir.path, to: fileCloneDir) else {
                throw SpikeError.step("file:// clone")
            }
            guard await appendPageAndCommit(dir: fileCloneDir) != nil else {
                throw SpikeError.step("file:// commit")
            }
            guard await push(dir: fileCloneDir) else {
                throw SpikeError.step("file:// push")
            }
            // Acceptance: remote contains the new commit — re-read the bare
            // repo's HEAD message in-process (host-side `git log` in NOTES is
            // the second, external check).
            let remoteHasCommit = await offMain { () -> Bool in
                var bare: OpaquePointer? = nil
                guard git_repository_open(&bare, bareDir.path) == 0, let bare = bare else { return false }
                defer { git_repository_free(bare) }
                var oid = git_oid()
                guard git_reference_name_to_id(&oid, bare, "HEAD") == 0 else { return false }
                var commit: OpaquePointer? = nil
                guard git_commit_lookup(&commit, bare, &oid) == 0, let commit = commit else { return false }
                defer { git_commit_free(commit) }
                guard let message = git_commit_message(commit) else { return false }
                return String(cString: message).contains("spike: append pages/")
            }
            guard remoteHasCommit else { throw SpikeError.step("remote HEAD missing spike commit") }
            logLine("✓ file:// round trip — remote HEAD contains the spike commit")
            fileLeg.ok = true
            fileLeg.detail = "bare repo in app container; remote HEAD re-read in-process"
        } catch {
            fileLeg.detail = error.localizedDescription
            logLine("✗ file:// leg failed: \(error.localizedDescription)")
        }

        // Leg 2: HTTP + Basic (allternit_git_ token) round trip.
        let httpCloneDir = docs.appendingPathComponent("brain-spike/http-clone")
        var httpLeg = BrainSpikeLegResult(attempted: !httpURL.isEmpty, ok: false, detail: "")
        if !httpURL.isEmpty {
            if await clone(url: httpURL, to: httpCloneDir, username: username, token: token),
               await appendPageAndCommit(dir: httpCloneDir) != nil,
               await push(dir: httpCloneDir, username: username, token: token) {
                logLine("✓ HTTP+Basic round trip — pushed to \(httpURL)")
                httpLeg.ok = true
                httpLeg.detail = "clone→commit→push over smart-HTTP with Basic token auth"
            } else {
                httpLeg.detail = "see log — last ✗ line"
            }
        } else {
            httpLeg.detail = "no URL supplied"
            logLine("· HTTP leg skipped (no URL)")
        }

        // Leg 3: public HTTPS clone (TLS signal only — no auth, no push).
        let httpsCloneDir = docs.appendingPathComponent("brain-spike/https-clone")
        var httpsLeg = BrainSpikeLegResult(attempted: true, ok: false, detail: "")
        if await clone(url: "https://github.com/octocat/Hello-World.git", to: httpsCloneDir) {
            httpsLeg.ok = true
            httpsLeg.detail = "anonymous clone of github.com/octocat/Hello-World"
        } else {
            httpsLeg.detail = "see log — last ✗ line"
        }

        let result = BrainSpikeResult(
            startedAt: ISO8601DateFormatter().string(from: Date()),
            libgit2Version: libgit2Version,
            fileRoundTrip: fileLeg,
            httpBasicRoundTrip: httpLeg,
            httpsPublicClone: httpsLeg,
            log: log)
        let resultURL = docs.appendingPathComponent("brain-spike-result.json")
        if let data = try? JSONEncoder.brainSpike.encode(result) {
            try? data.write(to: resultURL)
            logLine("· result written: \(resultURL.path)")
        }
        logLine("— proof finished (file: \(fileLeg.ok ? "OK" : "FAIL"), http: \(httpLeg.ok ? "OK" : "FAIL"), https: \(httpsLeg.ok ? "OK" : "FAIL"))")
    }

    private enum SpikeError: LocalizedError {
        case step(String)
        var errorDescription: String? {
            switch self {
            case .step(let name): return "step failed: \(name)"
            }
        }
    }
}

private extension JSONEncoder {
    static var brainSpike: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
#endif
