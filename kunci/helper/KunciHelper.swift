import AppKit
import ApplicationServices
import Foundation

let kVKAnsiV: CGKeyCode = 0x09
let kVKTab: CGKeyCode = 0x30

@main
struct KunciHelper {
    static func main() {
        _ = NSApplication.shared
        let args = Array(CommandLine.arguments.dropFirst())
        let cmd = args.first ?? "prompt"
        switch cmd {
        case "status":
            print(isTrusted() ? "trusted=true" : "trusted=false")
        case "prompt":
            print(promptTrust() ? "trusted=true" : "trusted=false")
        case "apps":
            print(listAppsJSON())
        case "frontmost":
            print(frontmostName() ?? "")
        case "fill":
            let path = args.dropFirst().first
            guard let path, let job = readJob(path) else {
                fputs("job JSON tidak ada\n", stderr)
                exit(1)
            }
            doFill(job)
            print("ok=true")
        default:
            fputs("usage: Kunci Helper status|prompt|apps|frontmost|fill <job.json>\n", stderr)
            exit(2)
        }
    }
}

func isTrusted() -> Bool {
    AXIsProcessTrusted()
}

func promptTrust() -> Bool {
    let opts = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
    return AXIsProcessTrustedWithOptions(opts)
}

func runningRegular() -> [NSRunningApplication] {
    NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }
}

func listAppsJSON() -> String {
    let names = Array(Set(runningRegular().compactMap(\.localizedName))).sorted()
    let data = try? JSONSerialization.data(withJSONObject: names)
    return String(data: data ?? Data("[]".utf8), encoding: .utf8) ?? "[]"
}

func frontmostName() -> String? {
    runningRegular().first(where: \.isActive)?.localizedName
}

func activate(named raw: String) {
    let want = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !want.isEmpty else { return }
    let apps = runningRegular()
    let hit =
        apps.first { ($0.localizedName ?? "").lowercased() == want }
        ?? apps.first { ($0.localizedName ?? "").lowercased().contains(want) }
        ?? apps.first { want.contains(($0.localizedName ?? "").lowercased()) }
    hit?.activate(options: [.activateIgnoringOtherApps])
    Thread.sleep(forTimeInterval: 0.4)
}

func keystroke(_ key: CGKeyCode, flags: CGEventFlags = []) {
    let src = CGEventSource(stateID: .hidSystemState)
    if let down = CGEvent(keyboardEventSource: src, virtualKey: key, keyDown: true) {
        down.flags = flags
        down.post(tap: .cghidEventTap)
    }
    if let up = CGEvent(keyboardEventSource: src, virtualKey: key, keyDown: false) {
        up.flags = flags
        up.post(tap: .cghidEventTap)
    }
}

func pasteString(_ value: String) {
    let board = NSPasteboard.general
    let previous = board.string(forType: .string)
    board.clearContents()
    board.setString(value, forType: .string)
    Thread.sleep(forTimeInterval: 0.08)
    keystroke(kVKAnsiV, flags: .maskCommand)
    Thread.sleep(forTimeInterval: 0.12)
    board.clearContents()
    if let previous {
        board.setString(previous, forType: .string)
    }
}

func setFocused(_ value: String) -> Bool {
    let system = AXUIElementCreateSystemWide()
    var focused: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(system, kAXFocusedUIElementAttribute as CFString, &focused)
    guard err == .success, let focused else { return false }
    let el = focused as! AXUIElement
    return AXUIElementSetAttributeValue(el, kAXValueAttribute as CFString, value as CFTypeRef) == .success
}

struct FillJob {
    var username: String
    var password: String
    var mode: String
    var appName: String
    var waitMs: Double
}

func readJob(_ path: String) -> FillJob? {
    guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return FillJob(
        username: obj["username"] as? String ?? "",
        password: obj["password"] as? String ?? "",
        mode: obj["mode"] as? String ?? "login",
        appName: obj["appName"] as? String ?? "",
        waitMs: (obj["waitMs"] as? NSNumber)?.doubleValue ?? 0
    )
}

func doFill(_ job: FillJob) {
    if !promptTrust() {
        fputs("Kunci Helper belum diizinkan. System Settings → Privacy & Security → Accessibility → centang Kunci Helper.\n", stderr)
        exit(1)
    }
    if job.waitMs > 0 {
        Thread.sleep(forTimeInterval: min(job.waitMs, 8000) / 1000)
    }
    if !job.appName.isEmpty {
        activate(named: job.appName)
    }
    let login = job.mode == "login" && !job.username.isEmpty
    if login {
        if !setFocused(job.username) {
            pasteString(job.username)
        }
        Thread.sleep(forTimeInterval: 0.12)
        keystroke(kVKTab)
        Thread.sleep(forTimeInterval: 0.1)
    }
    if !job.password.isEmpty {
        if !setFocused(job.password) {
            pasteString(job.password)
        }
    }
}
