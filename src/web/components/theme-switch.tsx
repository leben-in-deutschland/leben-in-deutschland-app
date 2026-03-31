"use client";

import { MoonFilledIcon } from "@/icons/MoonFilledIcon";
import { SunFilledIcon } from "@/icons/SunFilledIcon";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useTheme } from "next-themes";
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { Button } from "@heroui/button";
import { SunMoonIcon } from "@/icons/SunMoonIcon";
import { useEffect, useState } from "react";

export const ThemeSwitch = ({ onThemeChange, translation }: { onThemeChange?: () => void, translation?: any } = {}) => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const onChange = (newTheme: string) => {
        setTheme(newTheme);
        onThemeChange?.();
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            let tempTheme = theme;
            if (theme === "system") {
                const darkModePreference = window.matchMedia("(prefers-color-scheme: dark)");
                tempTheme = darkModePreference.matches ? "dark" : "light";
            }
            const style = tempTheme === "light" ? Style.Light : Style.Dark;
            const backgroundColor = tempTheme === "light" ? "#FFFFFF" : "#000000";
            EdgeToEdge.setBackgroundColor({ color: backgroundColor });
            StatusBar.setOverlaysWebView({ overlay: true });
            StatusBar.hide();
            StatusBar.setBackgroundColor({ color: backgroundColor });
            StatusBar.setStyle({ style: style });
        }
    }, [theme]);

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
