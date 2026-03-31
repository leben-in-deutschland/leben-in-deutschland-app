"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from "next-themes";
import ToastProvider from "@/components/toast-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Capacitor } from "@capacitor/core";

export interface ProvidersProps {
    children: React.ReactNode;
    themeProps?: any;
}

export function Providers({ children, themeProps }: ProvidersProps) {
    const router = useRouter();
    const [showSpeedInsights, setShowSpeedInsights] = React.useState(false);

    React.useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            setShowSpeedInsights(true);
        }
    }, []);

    return (
        <React.Suspense>
            <HeroUIProvider navigate={router.push}>
                <NextThemesProvider {...themeProps}>
                    <ToastProvider>
                        {showSpeedInsights && <SpeedInsights />}
                        {children}
                    </ToastProvider>
                </NextThemesProvider>
            </HeroUIProvider>
        </React.Suspense>
    );
}