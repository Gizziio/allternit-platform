/**
 * Minimal local contracts for the UI skeleton.
 * These are NOT the full spec system; they are build-now interfaces.
 */
export var NodeType;
(function (NodeType) {
    NodeType["Intent"] = "intent";
    NodeType["Task"] = "task";
    NodeType["Goal"] = "goal";
    NodeType["Decision"] = "decision";
    NodeType["Plan"] = "plan";
    NodeType["Artifact"] = "artifact";
    NodeType["Memory"] = "memory";
})(NodeType || (NodeType = {}));
export var EdgeType;
(function (EdgeType) {
    EdgeType["DependsOn"] = "depends_on";
    EdgeType["Blocks"] = "blocks";
    EdgeType["PartOf"] = "part_of";
    EdgeType["Implements"] = "implements";
    EdgeType["ContextFor"] = "context_for";
})(EdgeType || (EdgeType = {}));
export var NodeStatus;
(function (NodeStatus) {
    NodeStatus["Proposed"] = "proposed";
    NodeStatus["Active"] = "active";
    NodeStatus["Completed"] = "completed";
    NodeStatus["Deprecated"] = "deprecated";
})(NodeStatus || (NodeStatus = {}));
export var PersistenceMode;
(function (PersistenceMode) {
    PersistenceMode["Ephemeral"] = "ephemeral";
    PersistenceMode["Session"] = "session";
    PersistenceMode["Pinned"] = "pinned";
    PersistenceMode["Archived"] = "archived";
})(PersistenceMode || (PersistenceMode = {}));
export var FileSystemMode;
(function (FileSystemMode) {
    FileSystemMode["Deny"] = "deny";
    FileSystemMode["ReadOnly"] = "ro";
    FileSystemMode["ReadWrite"] = "rw";
})(FileSystemMode || (FileSystemMode = {}));
