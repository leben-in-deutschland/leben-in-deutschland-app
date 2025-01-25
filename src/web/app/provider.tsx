"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
export interface ProvidersProps {
    children: React.ReactNode;
    themeProps?: any;
}

export function Providers({ children, themeProps }: ProvidersProps) {
    const router = useRouter();
    return (
        <SessionProvider>
            <HeroUIProvider navigate={router.push}>
                <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
            </HeroUIProvider>
        </SessionProvider>
    );
}