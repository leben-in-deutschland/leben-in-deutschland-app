"use client";

import { MoonFilledIcon } from "@/icons/MoonFilledIcon";
import { SunFilledIcon } from "@/icons/SunFilledIcon";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Switch } from "@heroui/switch";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

export const ThemeSwitch = () => {
    const { theme, setTheme } = useTheme();
    const [isSelected, setIsSelected] = useState(!(theme === "light"));
    const onChange = () => {
        theme === "light" ? setTheme("dark") : setTheme("light");
        setIsSelected(theme === "light");
    };

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const style = theme === "light" ? Style.Light : Style.Dark;
            const backgroundColor = theme === "light" ? "#FFFFFF" : "#000000";
            EdgeToEdge.setBackgroundColor({ color: backgroundColor });
            StatusBar.setBackgroundColor({ color: backgroundColor });
            StatusBar.setStyle({ style: style });
        };
    }, [theme]);

    return (
        <div className="h-auto bg-transparent rounded-lg justify-center group-data-[selected=true]:bg-transparent !text-default-500">
            <Switch
                defaultSelected
                size="lg"
                color="success"
                startContent={<SunFilledIcon />}
                endContent={<MoonFilledIcon />}
                isSelected={isSelected}
                onChange={onChange}
            >
            </Switch>
        </div>
    );
};