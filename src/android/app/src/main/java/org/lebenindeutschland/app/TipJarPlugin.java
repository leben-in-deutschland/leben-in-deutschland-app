package org.lebenindeutschland.app;

import android.app.Activity;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClient.BillingResponseCode;
import com.android.billingclient.api.BillingClient.ProductType;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONException;

/**
 * Tip jar on Google Play Billing. It does three things: list the tip
 * products, buy one and consume it right away so it can be bought again, and
 * consume anything that was paid for but never consumed (for example after a
 * crash between payment and consumption).
 *
 * A tip counts as given when it is consumed. The JavaScript side therefore
 * counts "purchased" outcomes and the number returned by recoverPurchases,
 * and nothing else.
 */
@CapacitorPlugin(name = "TipJar")
public class TipJarPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "TipJar";

    private interface ResultCallback {
        void onResult(@NonNull BillingResult result);
    }

    private interface DetailsCallback {
        void onDetails(@NonNull BillingResult result, @NonNull List<ProductDetails> details);
    }

    private interface CountCallback {
        void onCount(int count);
    }

    private BillingClient client;
    private final List<ResultCallback> waitingForConnection = new ArrayList<>();
    private boolean connecting = false;

    /** The call of the purchase flow that is currently open in Google Play, if any. */
    @Nullable
    private PluginCall purchaseCall;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) {
            client.endConnection();
        }
    }

    /** Lists the given one-time products in the requested order; missing products are left out. */
    @PluginMethod
    public void getProducts(PluginCall call) {
        List<String> ids = stringList(call.getArray("ids"));
        if (ids.isEmpty()) {
            call.reject("ids must be a non-empty array");
            return;
        }
        connect(connection -> {
            if (connection.getResponseCode() != BillingResponseCode.OK) {
                call.resolve(productsResult(false, Collections.emptyList()));
                return;
            }
            queryDetails(ids, (result, details) -> call.resolve(productsResult(result.getResponseCode() == BillingResponseCode.OK, details)));
        });
    }

    /** Opens the Google Play purchase sheet for one product and consumes the purchase. */
    @PluginMethod
    public void purchase(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id must be provided");
            return;
        }
        if (purchaseCall != null) {
            call.resolve(outcome("failed", "A purchase is already in progress"));
            return;
        }
        connect(connection -> {
            if (connection.getResponseCode() != BillingResponseCode.OK) {
                call.resolve(outcome("unavailable", connection.getDebugMessage()));
                return;
            }
            queryDetails(Collections.singletonList(id), (result, details) -> {
                if (result.getResponseCode() != BillingResponseCode.OK || details.isEmpty()) {
                    call.resolve(outcome("unavailable", "Product not found: " + id));
                    return;
                }
                launch(call, details.get(0));
            });
        });
    }

    /** Consumes purchases that were paid for but never consumed and reports how many. */
    @PluginMethod
    public void recoverPurchases(PluginCall call) {
        connect(connection -> {
            if (connection.getResponseCode() != BillingResponseCode.OK) {
                call.resolve(countResult(0));
                return;
            }
            recover(count -> call.resolve(countResult(count)));
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, @Nullable List<Purchase> purchases) {
        PluginCall call = purchaseCall;
        purchaseCall = null;
        int code = result.getResponseCode();
        Log.i(TAG, "purchase update: code " + code);

        if (call == null) {
            // No open flow, e.g. a pending payment completed in the background.
            // Leave it unconsumed; recoverPurchases will consume and count it.
            return;
        }
        if (code == BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            settle(purchases, call);
        } else if (code == BillingResponseCode.USER_CANCELED) {
            call.resolve(outcome("cancelled", null));
        } else if (code == BillingResponseCode.ITEM_ALREADY_OWNED) {
            // An earlier tip was never consumed; consuming it now is the honest outcome.
            recover(count -> call.resolve(outcome(count > 0 ? "purchased" : "failed", result.getDebugMessage())));
        } else {
            call.resolve(outcome("failed", result.getDebugMessage()));
        }
    }

    private void launch(PluginCall call, ProductDetails product) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(outcome("failed", "No activity"));
            return;
        }
        BillingFlowParams.ProductDetailsParams.Builder item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product);
        ProductDetails.OneTimePurchaseOfferDetails offer = firstOffer(product);
        if (offer != null && offer.getOfferToken() != null) {
            item.setOfferToken(offer.getOfferToken());
        }
        BillingFlowParams params = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(item.build())).build();

        purchaseCall = call;
        activity.runOnUiThread(() -> {
            BillingResult launched = client.launchBillingFlow(activity, params);
            int code = launched.getResponseCode();
            if (code == BillingResponseCode.OK) {
                return; // The outcome arrives in onPurchasesUpdated.
            }
            purchaseCall = null;
            Log.i(TAG, "launch failed: code " + code + " " + launched.getDebugMessage());
            if (code == BillingResponseCode.ITEM_ALREADY_OWNED) {
                recover(count -> call.resolve(outcome(count > 0 ? "purchased" : "failed", launched.getDebugMessage())));
            } else {
                call.resolve(outcome("failed", launched.getDebugMessage()));
            }
        });
    }

    /** Consumes every purchased item of a finished flow and resolves the call once all are settled. */
    private void settle(List<Purchase> purchases, PluginCall call) {
        List<Purchase> paid = new ArrayList<>();
        boolean pending = false;
        for (Purchase purchase : purchases) {
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                paid.add(purchase);
            } else if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                pending = true;
            }
        }
        if (paid.isEmpty()) {
            call.resolve(outcome(pending ? "pending" : "failed", null));
            return;
        }
        consumeAll(paid, consumed -> {
            // Paid but not consumed yet (rare): the next recoverPurchases call finishes it.
            call.resolve(outcome(consumed > 0 ? "purchased" : "pending", null));
        });
    }

    private void recover(CountCallback callback) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build();
        client.queryPurchasesAsync(params, (result, purchases) -> {
            if (result.getResponseCode() != BillingResponseCode.OK || purchases == null) {
                callback.onCount(0);
                return;
            }
            List<Purchase> paid = new ArrayList<>();
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    paid.add(purchase);
                }
            }
            Log.i(TAG, "recover: " + paid.size() + " unconsumed");
            consumeAll(paid, callback);
        });
    }

    private void consumeAll(List<Purchase> purchases, CountCallback callback) {
        if (purchases.isEmpty()) {
            callback.onCount(0);
            return;
        }
        AtomicInteger remaining = new AtomicInteger(purchases.size());
        AtomicInteger consumed = new AtomicInteger(0);
        for (Purchase purchase : purchases) {
            ConsumeParams params = ConsumeParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build();
            client.consumeAsync(params, (result, token) -> {
                if (result.getResponseCode() == BillingResponseCode.OK) {
                    consumed.incrementAndGet();
                } else {
                    Log.w(TAG, "consume failed: code " + result.getResponseCode());
                }
                if (remaining.decrementAndGet() == 0) {
                    callback.onCount(consumed.get());
                }
            });
        }
    }

    private void queryDetails(List<String> ids, DetailsCallback callback) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : ids) {
            products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(ProductType.INAPP).build());
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(products).build();
        client.queryProductDetailsAsync(params, (result, queryResult) -> {
            List<ProductDetails> found = queryResult.getProductDetailsList();
            Log.i(TAG, "products: code " + result.getResponseCode() + ", " + found.size() + " found, " + queryResult.getUnfetchedProductList().size() + " unfetched");
            List<ProductDetails> ordered = new ArrayList<>();
            for (String id : ids) {
                for (ProductDetails details : found) {
                    if (id.equals(details.getProductId())) {
                        ordered.add(details);
                    }
                }
            }
            callback.onDetails(result, ordered);
        });
    }

    /** Runs the callback once the client is connected; concurrent callers share one connection attempt. */
    private void connect(ResultCallback callback) {
        if (client.isReady()) {
            callback.onResult(BillingResult.newBuilder().setResponseCode(BillingResponseCode.OK).build());
            return;
        }
        synchronized (waitingForConnection) {
            waitingForConnection.add(callback);
            if (connecting) {
                return;
            }
            connecting = true;
        }
        client.startConnection(
            new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(@NonNull BillingResult result) {
                    Log.i(TAG, "connected: code " + result.getResponseCode());
                    List<ResultCallback> callbacks;
                    synchronized (waitingForConnection) {
                        callbacks = new ArrayList<>(waitingForConnection);
                        waitingForConnection.clear();
                        connecting = false;
                    }
                    for (ResultCallback waiting : callbacks) {
                        waiting.onResult(result);
                    }
                }

                @Override
                public void onBillingServiceDisconnected() {
                    // Automatic reconnection is enabled; the next call connects again if needed.
                }
            }
        );
    }

    @Nullable
    private static ProductDetails.OneTimePurchaseOfferDetails firstOffer(ProductDetails product) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = product.getOneTimePurchaseOfferDetailsList();
        if (offers != null && !offers.isEmpty()) {
            return offers.get(0);
        }
        return product.getOneTimePurchaseOfferDetails();
    }

    private static JSObject productsResult(boolean available, List<ProductDetails> details) {
        JSArray products = new JSArray();
        for (ProductDetails item : details) {
            ProductDetails.OneTimePurchaseOfferDetails offer = firstOffer(item);
            if (offer == null) {
                continue;
            }
            JSObject product = new JSObject();
            product.put("id", item.getProductId());
            product.put("name", item.getName());
            product.put("price", offer.getFormattedPrice());
            product.put("currency", offer.getPriceCurrencyCode());
            products.put(product);
        }
        JSObject result = new JSObject();
        result.put("available", available);
        result.put("products", products);
        return result;
    }

    private static JSObject outcome(String state, @Nullable String message) {
        JSObject result = new JSObject();
        result.put("state", state);
        if (message != null && !message.isEmpty()) {
            result.put("message", message);
        }
        return result;
    }

    private static JSObject countResult(int count) {
        JSObject result = new JSObject();
        result.put("consumed", count);
        return result;
    }

    private static List<String> stringList(@Nullable JSArray array) {
        List<String> values = new ArrayList<>();
        if (array == null) {
            return values;
        }
        for (int i = 0; i < array.length(); i++) {
            try {
                values.add(array.getString(i));
            } catch (JSONException ignored) {
                // Skip entries that are not strings.
            }
        }
        return values;
    }
}
