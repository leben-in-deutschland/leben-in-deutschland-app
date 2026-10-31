"use client";

import { Button } from "@heroui/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import { useNoticeFlags } from "@/components/home/use-notices";
import { IconBadge } from "@/components/ui/icon-badge";
import { HeartIcon } from "@/components/ui/icons";
import { loadTipProducts, recoverTips, sendTip, tipJarSupported, type TipProduct } from "@/services/tip-jar";
import { storeName } from "@/utils/app-store";
import { fmt, plural } from "@/utils/i18n";
import { readSupport, recordTips } from "@/utils/support-store";
import { useTranslations } from "@/utils/user-store";
import { SettingsSection } from "./settings-shared";

const noopSubscribe = () => () => {};

/**
 * Optional tips through Google Play or the App Store. Only rendered in the
 * Android and iOS apps, and only once the store returns at least one tip
 * product, so learners never see an empty or broken section. The owner can switch it off remotely
 * (`flags.tipJar` in the notice file, ADR-006). Tips unlock nothing.
 */
export function SupportSection() {
    const t = useTranslations();
    const enabled = useNoticeFlags().tipJar;
    const supported = useSyncExternalStore(noopSubscribe, tipJarSupported, () => false) && enabled;
    const [products, setProducts] = useState<TipProduct[]>([]);
    const [tips, setTips] = useState(0);
    const [buying, setBuying] = useState<string | null>(null);

    useEffect(() => {
        if (!supported) {
            return;
        }
        let active = true;
        void (async () => {
            // Finish tips paid earlier but never counted, then show the total and load the products.
            const recovered = await recoverTips();
            if (!active) {
                return;
            }
            setTips(recovered > 0 ? recordTips(recovered).tips : readSupport().tips);
            const list = await loadTipProducts();
            if (active) {
                setProducts(list);
            }
        })();
        return () => {
            active = false;
        };
    }, [supported]);

    const tip = useCallback(
        async (product: TipProduct) => {
            setBuying(product.id);
            const outcome = await sendTip(product.id);
            setBuying(null);
            switch (outcome) {
                case "purchased":
                    setTips(recordTips(1).tips);
                    toast.success(t.settings_support_thanks_toast);
                    break;
                case "pending":
                    toast.info(fmt(t.settings_support_pending, { store: storeName() }));
                    break;
                case "cancelled":
                    break;
                default:
                    toast.error(t.settings_support_failed);
            }
        },
        [t],
    );

    if (!supported || products.length === 0) {
        return null;
    }

    return (
        <SettingsSection
            id="support"
            title={t.settings_section_support}
            footer={<p className="px-1 text-xs leading-relaxed text-default-500">{fmt(t.settings_support_via_play, { store: storeName() })}</p>}
        >
            <div className="space-y-4 px-4 py-4">
                <div className="flex items-start gap-3">
                    <IconBadge icon={HeartIcon} accent="danger" />
                    <p className="min-w-0 flex-1 pt-1 text-sm leading-relaxed text-default-600">{t.settings_support_text}</p>
                </div>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label={t.settings_section_support}>
                    {products.map((product) => (
                        <Button
                            key={product.id}
                            variant="flat"
                            color="primary"
                            className="h-auto min-h-[60px] flex-col gap-0.5 px-2 py-2"
                            isLoading={buying === product.id}
                            isDisabled={buying !== null && buying !== product.id}
                            onPress={() => void tip(product)}
                            aria-label={fmt(t.settings_support_tip_aria, { name: product.name, price: product.price })}
                        >
                            <span className="truncate text-xs font-medium text-primary-700/80">{product.name}</span>
                            <span className="text-base font-semibold tabular-nums">{product.price}</span>
                        </Button>
                    ))}
                </div>
                {tips > 0 ? (
                    <p className="text-sm font-medium text-success-700" aria-live="polite">
                        {plural(t, "settings_support_thanked", tips)}
                    </p>
                ) : null}
            </div>
        </SettingsSection>
    );
}
