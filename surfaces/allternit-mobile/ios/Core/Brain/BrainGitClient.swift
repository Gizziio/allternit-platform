//
// Production embedded git client for the second brain (Track D, phase D3).
// Hardened version of the D3 spike wrapper
// (Features/Settings/BrainSpike/BrainGit.swift — DEBUG-gated, untouched):
// proper throwing error type carrying libgit2's `git_error_last` message, no
// Bool/String? results, no DEBUG gate. Wraps the vendored
// libgit2.xcframework (module `Clibgit2`, linked in every configuration).
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

/// Typed error for every git operation, always carrying libgit2's
/// `git_error_last` message when one is available.
enum BrainGitError: LocalizedError {
    case git(op: String, message: String)
    case io(op: String, message: String)

    var errorDescription: String? {
        switch self {
        case .git(let op, let message): return "git \(op) failed: \(message)"
        case .io(let op, let message): return "\(op) failed: \(message)"
        }
    }
}

/// Serial, off-main libgit2 wrapper: clone → stage-all + commit → push, over
/// HTTP(S)+Basic and file://. `@unchecked Sendable`: every libgit2 call is
/// serialized on `queue`, one operation at a time.
final class BrainGitClient: @unchecked Sendable {
    /// Serial queue for all libgit2 calls.
    private let queue = DispatchQueue(label: "com.allternit.brain.git")

    init() {
        git_libgit2_init()
    }

    static var libgit2Version: String {
        var major: Int32 = 0, minor: Int32 = 0, rev: Int32 = 0
        git_libgit2_version(&major, &minor, &rev)
        return "\(major).\(minor).\(rev)"
    }

    private func lastGitError(op: String, fallback: String) -> BrainGitError {
        if let err = git_error_last(), let message = err.pointee.message {
            return .git(op: op, message: String(cString: message))
        }
        return .git(op: op, message: fallback)
    }

    private func offMain<T>(_ work: @escaping @Sendable () throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { cont in
            queue.async { cont.resume(with: Result(catching: work)) }
        }
    }

    // MARK: - Operations

    /// Clone `url` into `dir` (wiped first). Cloning the freshly provisioned
    /// — hence empty — hosted remote succeeds with an unborn HEAD; the first
    /// `commitAll` (update-ref "HEAD") then creates the branch. Empty
    /// username/token = anonymous (public clone or file://); otherwise HTTP
    /// Basic with the `allternit_git_` token as password.
    func clone(url: String, to dir: URL, username: String = "", token: String = "") async throws {
        try await offMain {
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
                throw self.lastGitError(op: "clone", fallback: "git_clone rc=\(rc)")
            }
            git_repository_free(repo)
        }
    }

    /// Fallback when cloning the empty hosted remote fails in practice:
    /// equivalent local repo — `git init` + `origin` remote pointing at the
    /// clone URL. The rest of the flow (write templates → commitAll → push)
    /// is identical either way.
    func initRepoWithOrigin(dir: URL, remoteURL: String) async throws {
        try await offMain {
            try? FileManager.default.removeItem(at: dir)
            do {
                try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            } catch {
                throw BrainGitError.io(op: "create repo dir", message: error.localizedDescription)
            }
            var repo: OpaquePointer? = nil
            guard git_repository_init(&repo, dir.path, 0) == 0, let repo = repo else {
                throw self.lastGitError(op: "init", fallback: "git_repository_init")
            }
            defer { git_repository_free(repo) }
            var remote: OpaquePointer? = nil
            guard git_remote_create(&remote, repo, "origin", remoteURL) == 0 else {
                throw self.lastGitError(op: "remote add origin", fallback: "git_remote_create")
            }
            git_remote_free(remote)
        }
    }

    /// Stage every change in the repo at `dir` (git_index_add_all with a
    /// `*` pathspec — covers the 7 template files on init and each new
    /// ideas/ page on capture) and commit on the current branch with
    /// `message`. The first commit has no parent (unborn HEAD of an empty
    /// clone); later commits parent on HEAD.
    func commitAll(dir: URL, message: String) async throws {
        try await offMain {
            var repo: OpaquePointer? = nil
            guard git_repository_open(&repo, dir.path) == 0, let repo = repo else {
                throw self.lastGitError(op: "open repo", fallback: "git_repository_open")
            }
            defer { git_repository_free(repo) }

            var index: OpaquePointer? = nil
            guard git_repository_index(&index, repo) == 0, let index = index else {
                throw self.lastGitError(op: "index", fallback: "git_repository_index")
            }
            defer { git_index_free(index) }

            var star = strdup("*")
            var pathspec = git_strarray(strings: &star, count: 1)
            let addRC = git_index_add_all(
                index, &pathspec, UInt32(GIT_INDEX_ADD_DEFAULT.rawValue), nil, nil)
            free(star)
            guard addRC == 0, git_index_write(index) == 0 else {
                throw self.lastGitError(op: "stage", fallback: "git_index_add_all")
            }

            var treeOID = git_oid()
            var tree: OpaquePointer? = nil
            guard git_index_write_tree(&treeOID, index) == 0,
                  git_tree_lookup(&tree, repo, &treeOID) == 0, let tree = tree else {
                throw self.lastGitError(op: "write tree", fallback: "git_index_write_tree")
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
            guard git_signature_now(&signature, "Allternit Brain (iOS)", "brain-ios@allternit.local") == 0 else {
                throw self.lastGitError(op: "signature", fallback: "git_signature_now")
            }
            defer { git_signature_free(signature) }

            var commitOID = git_oid()
            var mutableParents = parents
            let rc = mutableParents.withUnsafeMutableBufferPointer { buffer in
                git_commit_create(
                    &commitOID, repo, "HEAD",
                    signature, signature, nil, message, tree,
                    parents.count, buffer.baseAddress)
            }
            guard rc == 0 else {
                throw self.lastGitError(op: "commit", fallback: "git_commit_create")
            }
        }
    }

    /// Push the current branch to `origin` with the same Basic credentials
    /// as clone. Idempotent — retrying after a failed push just re-sends the
    /// same commits.
    func push(dir: URL, username: String = "", token: String = "") async throws {
        try await offMain {
            var repo: OpaquePointer? = nil
            guard git_repository_open(&repo, dir.path) == 0, let repo = repo else {
                throw self.lastGitError(op: "open repo", fallback: "git_repository_open")
            }
            defer { git_repository_free(repo) }

            var head: OpaquePointer? = nil
            guard git_repository_head(&head, repo) == 0, let head = head,
                  let refName = git_reference_name(head) else {
                throw self.lastGitError(op: "read HEAD", fallback: "git_repository_head")
            }
            let branch = String(cString: refName)
                .replacingOccurrences(of: "refs/heads/", with: "")
            git_reference_free(head)

            var remote: OpaquePointer? = nil
            guard git_remote_lookup(&remote, repo, "origin") == 0, let remote = remote else {
                throw self.lastGitError(op: "lookup origin", fallback: "git_remote_lookup")
            }
            defer { git_remote_free(remote) }

            var options = git_push_options()
            git_push_options_init(&options, UInt32(GIT_PUSH_OPTIONS_VERSION))
            let box = CredentialBox(username: username, password: token)
            options.callbacks.credentials = acquireCredentials
            options.callbacks.payload = Unmanaged.passUnretained(box).toOpaque()

            let refspec = "refs/heads/\(branch):refs/heads/\(branch)"
            var spec = strdup(refspec)
            var refspecs = git_strarray(strings: &spec, count: 1)
            let rc = withExtendedLifetime(box) {
                git_remote_push(remote, &refspecs, &options)
            }
            free(spec)
            guard rc == 0 else {
                throw self.lastGitError(op: "push", fallback: "git_remote_push rc=\(rc)")
            }
        }
    }
}
