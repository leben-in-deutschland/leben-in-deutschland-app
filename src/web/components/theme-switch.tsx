"use client";

import { MoonFilledIcon } from "@/icons/MoonFilledIcon";
import { SunFilledIcon } from "@/icons/SunFilledIcon";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { useTheme } from "next-themes";
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { Button } from "@heroui/button";
import { SunMoonIcon } from "@/icons/SunMoonIcon";
import { useEffect, useState } from "react";

interface AppSystemBarsPlugin {
    setStyle(options: { light: boolean }): Promise<void>;
}

const AppSystemBars = registerPlugin<AppSystemBarsPlugin>("AppSystemBars");

export const ThemeSwitch = ({ onThemeChange, translation }: { onThemeChange?: () => void, translation?: any } = {}) => {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const onChange = (newTheme: string) => {
        setTheme(newTheme);
        onThemeChange?.();
    };

    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        if (Capacitor.getPlatform() === "android") {
            const light = (theme === "system" ? resolvedTheme : theme) === "light";
            const backgroundColor = light ? "#FFFFFF" : "#000000";
            void Promise.all([
                EdgeToEdge.setBackgroundColor({ color: backgroundColor }),
                AppSystemBars.setStyle({ light }),
            ]).catch((error: unknown) => {
                console.error("Failed to update Android system bar background", error);
            });
        }
    }, [resolvedTheme, theme]);

    // Render a placeholder with the same dimensions during SSR to avoid hydration mismatch
    if (!mounted) {
        return (
            <div className="flex gap-1">
                <div className="w-10 h-10" />
                <div className="w-10 h-10" />
                <div className="w-10 h-10" />
            </div>
        );
    }

    return (
        <div className="flex gap-1">
            <Button
                variant={theme === "light" ? "bordered" : "light"}
                color={theme === "light" ? "primary" : "default"}
                onPress={() => onChange("light")}
                isIconOnly
                aria-label={translation?.theme_light ?? "Light theme"}
                startContent={<SunFilledIcon />} />
            <Button
                variant={theme === "system" ? "bordered" : "light"}
                color={theme === "system" ? "primary" : "default"}
                onPress={() => onChange("system")}
                isIconOnly
                aria-label={translation?.theme_system ?? "System theme"}
                startContent={<SunMoonIcon />} />
            <Button
                variant={theme === "dark" ? "bordered" : "light"}
                color={theme === "dark" ? "primary" : "default"}
                onPress={() => onChange("dark")}
                isIconOnly
                aria-label={translation?.theme_dark ?? "Dark theme"}
                startContent={<MoonFilledIcon />} />
        </div>
    );
};
