"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from 'next/navigation'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import ToastProvider from "@/components/toast-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { navigateTo } from "@/utils/navigation";
import { useIsNative } from "@/utils/user-store";

export interface ProvidersProps {
    children: React.ReactNode;
    themeProps?: ThemeProviderProps;
}

export function Providers({ children, themeProps }: ProvidersProps) {
    const router = useRouter();
    const isNative = useIsNative();
    // HeroUI links and buttons with href navigate through this; on Android it
    // switches to the bundled .html files.
    const navigate = React.useCallback((path: string) => navigateTo(path, router.push), [router]);

    return (
        <React.Suspense>
            <HeroUIProvider navigate={navigate}>
                <NextThemesProvider {...themeProps}>
                    <ToastProvider>
                        {!isNative && <SpeedInsights />}
                        {children}
                    </ToastProvider>
                </NextThemesProvider>
            </HeroUIProvider>
        </React.Suspense>
    );
}
