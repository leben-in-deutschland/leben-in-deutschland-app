"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from "next-themes";
import ToastProvider from "@/components/toast-provider";

export interface ProvidersProps {
    children: React.ReactNode;
    themeProps?: any;
}

export function Providers({ children, themeProps }: ProvidersProps) {
    const router = useRouter();
    return (
        <React.Suspense>
            <HeroUIProvider navigate={router.push}>
                <NextThemesProvider {...themeProps}>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </NextThemesProvider>
            </HeroUIProvider>
        </React.Suspense>
    );
}