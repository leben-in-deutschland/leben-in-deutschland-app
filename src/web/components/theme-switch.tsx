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

export const ThemeSwitch = () => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const onChange = (newTheme: string) => {
        setTheme(newTheme)
    };

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
            StatusBar.setBackgroundColor({ color: backgroundColor });
            StatusBar.setStyle({ style: style });
        }
    }, [theme]);

    return (
        <div className="flex gap-1">
            {mounted &&
                <>
                    <Button
                        variant={theme === "light" ? "bordered" : "light"}
                        color={theme === "light" ? "primary" : "default"}
                        onPress={() => onChange("light")}
                        isIconOnly
                        startContent={<SunFilledIcon />} />
                    <Button
                        variant={theme === "system" ? "bordered" : "light"}
                        color={theme === "system" ? "primary" : "default"}
                        onPress={() => onChange("system")}
                        isIconOnly
                        startContent={<SunMoonIcon />} />
                    <Button
                        variant={theme === "dark" ? "bordered" : "light"}
                        color={theme === "dark" ? "primary" : "default"}
                        onPress={() => onChange("dark")}
                        isIconOnly
                        startContent={<MoonFilledIcon />} />
                </>
            }
        </div>
    );
};