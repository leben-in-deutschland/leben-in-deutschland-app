"use client";

// Adapted from 2.0: the Android system bars follow the theme through the
// shared shell (`components/shell/use-app-effects.ts`), so the EdgeToEdge and
// AppSystemBars calls were removed here. The three-button switch is unchanged.
import { MoonFilledIcon } from "@/classic/icons/MoonFilledIcon";
import { SunFilledIcon } from "@/classic/icons/SunFilledIcon";
import { useTheme } from "next-themes";
import { Button } from "@heroui/button";
import { SunMoonIcon } from "@/classic/icons/SunMoonIcon";
import { useHydrated } from "@/utils/user-store";

export const ThemeSwitch = ({ onThemeChange, translation }: { onThemeChange?: () => void, translation?: any } = {}) => {
    const { theme, setTheme } = useTheme();
    const mounted = useHydrated();

    const onChange = (newTheme: string) => {
        setTheme(newTheme);
        onThemeChange?.();
    };

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
