import Capacitor
import Foundation
import StoreKit

/**
 Tip jar on StoreKit 2, the iOS twin of `TipJarPlugin.java`. It does three
 things: list the tip products, buy one and finish the transaction right away
 so it can be bought again, and credit tips that arrive outside a purchase call
 (Ask to Buy approved later, a purchase interrupted before it was finished).

 A tip counts as given when its transaction is finished. The JavaScript side
 therefore counts "purchased" outcomes and the number returned by
 recoverPurchases, and nothing else - the same contract as on Android. The
 answers have the same shapes as the Android plugin:
 `{available, products: [{id, name, price, currency}]}`,
 `{state: purchased|pending|cancelled|unavailable|failed, message?}` and
 `{consumed}`.
 */
@objc(TipJarPlugin)
public class TipJarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TipJarPlugin"
    public let jsName = "TipJar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recoverPurchases", returnType: CAPPluginReturnPromise),
    ]

    private let ledger = TipLedger()
    private var updates: Task<Void, Never>?

    override public func load() {
        // Transactions that do not come back from purchase(): finish them at
        // once (Apple asks for that) and keep the credit until the next
        // recoverPurchases call counts it - like Android, which leaves such a
        // purchase unconsumed until recoverPurchases consumes and counts it.
        updates = Task { [ledger] in
            for await result in StoreKit.Transaction.updates {
                await ledger.settle(result, credit: true)
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    /// Lists the given consumable products in the requested order; missing products are left out.
    @objc func getProducts(_ call: CAPPluginCall) {
        guard let ids = call.getArray("ids", String.self), !ids.isEmpty else {
            call.reject("ids must be a non-empty array")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: ids)
                let ordered = ids.compactMap { id in products.first { $0.id == id } }
                call.resolve(["available": true, "products": ordered.map(Self.describe)])
            } catch {
                CAPLog.print("TipJar: products failed: \(error.localizedDescription)")
                call.resolve(["available": false, "products": []])
            }
        }
    }

    /// Opens the App Store purchase sheet for one product and finishes the transaction.
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("id must be provided")
            return
        }
        Task { @MainActor [ledger] in
            guard ledger.beginPurchase() else {
                call.resolve(Self.outcome("failed", "A purchase is already in progress"))
                return
            }
            defer { ledger.endPurchase() }
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.resolve(Self.outcome("unavailable", "Product not found: \(id)"))
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    switch await ledger.settle(verification, credit: false) {
                    case .counted:
                        call.resolve(Self.outcome("purchased", nil))
                    case .alreadyCredited:
                        // The updates listener got there first and kept the credit; recoverPurchases counts it.
                        call.resolve(Self.outcome("pending", nil))
                    case .rejected:
                        call.resolve(Self.outcome("failed", "The App Store could not verify the purchase"))
                    }
                case .pending:
                    call.resolve(Self.outcome("pending", nil))
                case .userCancelled:
                    call.resolve(Self.outcome("cancelled", nil))
                @unknown default:
                    call.resolve(Self.outcome("failed", nil))
                }
            } catch {
                CAPLog.print("TipJar: purchase failed: \(error.localizedDescription)")
                call.resolve(Self.outcome("failed", error.localizedDescription))
            }
        }
    }

    /// Finishes transactions that were paid but never counted and reports how many, including the credit kept by the listener.
    @objc func recoverPurchases(_ call: CAPPluginCall) {
        Task { [ledger] in
            for await result in StoreKit.Transaction.unfinished {
                await ledger.settle(result, credit: true)
            }
            let count = await ledger.takeCredit()
            call.resolve(["consumed": count])
        }
    }

    private static func describe(_ product: Product) -> JSObject {
        var item: JSObject = [
            "id": product.id,
            "name": product.displayName,
            "price": product.displayPrice,
        ]
        if #available(iOS 16.0, *) {
            item["currency"] = product.priceFormatStyle.currencyCode
        }
        return item
    }

    private static func outcome(_ state: String, _ message: String?) -> JSObject {
        var result: JSObject = ["state": state]
        if let message = message, !message.isEmpty {
            result["message"] = message
        }
        return result
    }
}

/// What settling a transaction did.
private enum Settlement {
    /// Verified, finished now, and counted (or credited) by this call.
    case counted
    /// Finished and credited earlier in this process; nothing to count again.
    case alreadyCredited
    /// Not verified by the App Store, or refunded; never counted.
    case rejected
}

/// Finishes verified transactions once each and keeps the credit for tips nobody has counted yet.
@MainActor
private final class TipLedger {
    private static let creditKey = "tipjar.credit"
    private var handled = Set<UInt64>()
    private var purchasing = false

    nonisolated init() {}

    func beginPurchase() -> Bool {
        if purchasing {
            return false
        }
        purchasing = true
        return true
    }

    func endPurchase() {
        purchasing = false
    }

    /// Finishes the transaction if it is verified and new. With `credit`, the tip is remembered for recoverPurchases instead of being counted by the caller.
    @discardableResult
    func settle(_ result: VerificationResult<StoreKit.Transaction>, credit: Bool) async -> Settlement {
        guard case .verified(let transaction) = result else {
            CAPLog.print("TipJar: unverified transaction ignored")
            return .rejected
        }
        if handled.contains(transaction.id) {
            return .alreadyCredited
        }
        handled.insert(transaction.id)
        await transaction.finish()
        guard transaction.revocationDate == nil else {
            return .rejected
        }
        if credit {
            let defaults = UserDefaults.standard
            defaults.set(defaults.integer(forKey: Self.creditKey) + 1, forKey: Self.creditKey)
        }
        return .counted
    }

    /// The tips credited by the listener since the last call, and resets the credit.
    func takeCredit() -> Int {
        let defaults = UserDefaults.standard
        let credit = defaults.integer(forKey: Self.creditKey)
        if credit != 0 {
            defaults.removeObject(forKey: Self.creditKey)
        }
        return max(credit, 0)
    }
}
