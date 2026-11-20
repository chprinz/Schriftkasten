// Zeigt eine Mitteilung mit dem App-Symbol und nimmt sie nach einigen Sekunden
// wieder zurück, damit sie nicht in der Mitteilungszentrale liegen bleibt.
// Aufruf: notify "Text" [Sekunden]
import Foundation
import UserNotifications

final class Delegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner])
    }
}

let args = CommandLine.arguments
guard args.count >= 2 else { exit(2) }
let text = args[1]
let seconds = args.count >= 3 ? (Double(args[2]) ?? 6) : 6

let center = UNUserNotificationCenter.current()
let delegate = Delegate()
center.delegate = delegate

let id = UUID().uuidString

// Sicherheitsnetz: nie länger als nötig laufen (z. B. wenn die Berechtigungsabfrage offen bleibt).
DispatchQueue.global().asyncAfter(deadline: .now() + seconds + 30) { exit(1) }
center.requestAuthorization(options: [.alert]) { granted, err in
    if let err = err { FileHandle.standardError.write(Data("auth: \(err)\n".utf8)) }
    guard granted else { exit(1) }
    let content = UNMutableNotificationContent()
    content.title = "Schriftkasten"
    content.body = text
    center.add(UNNotificationRequest(identifier: id, content: content, trigger: nil)) { error in
        if let error = error { FileHandle.standardError.write(Data("add: \(error)\n".utf8)); exit(1) }
        DispatchQueue.global().asyncAfter(deadline: .now() + seconds) {
            center.removeDeliveredNotifications(withIdentifiers: [id])
            // Entfernen braucht einen Moment, bevor der Prozess enden darf.
            Thread.sleep(forTimeInterval: 0.5)
            exit(0)
        }
    }
}
RunLoop.main.run()
