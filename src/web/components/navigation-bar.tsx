'use client'
import {
    Navbar,
    NavbarContent,
    NavbarMenu,
    NavbarMenuToggle,
    NavbarBrand,
    NavbarMenuItem,
} from "@heroui/navbar";
import { Divider, Tooltip } from "@heroui/react";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";

import { siteConfig } from "../config/site";
import NextLink from "next/link";


import { ThemeSwitch } from "./theme-switch";
import { DonateIcon } from "../icons/DonateIcon";

import { Logo } from "../icons/Logo";
import { GithubIcon } from "../icons/GithubIcon";
import { BitesInByteIcon } from "@/icons/BitesInByteIcon";
import { ShieldIcon } from "@/icons/ShieldIcon";
import { MailIcon } from "@/icons/MailIcon";
import { useState, useEffect } from "react";
import UserSetting from "./settings/user-setting";
import { SettingIcon } from "@/icons/SettingIcon";
import { DashboardIcon } from "@/icons/DashboardIcon";
import { ClipboardStatusIcon } from "@/icons/ClipboardStatusIcon";
import { Capacitor } from "@capacitor/core";
import { getTranslations } from "@/data/data";
import { getUserData } from "@/services/user";
import { User } from "@/types/user";

export const NavigationBar = () => {
    const [isSettingsClick, setSettingClicked] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNative, setIsNative] = useState(false);
    const [user, setUser] = useState<User>();
    const t = getTranslations(user?.appLanguage ?? "de");

    useEffect(() => {
        setIsNative(Capacitor.isNativePlatform());
        const tempUser = getUserData();
        if (tempUser !== null) setUser(tempUser);
    }, []);

    useEffect(() => {
        const handleUserChange = () => {
            const tempUser = getUserData();
            if (tempUser !== null) setUser(tempUser);
        };
        window.addEventListener("user", handleUserChange);
        return () => window.removeEventListener("user", handleUserChange);
    }, []);

    const handleSettingClick = () => {
        setIsMenuOpen(false);
        setSettingClicked(true);
    };
    const handleUserSettingsClose = () => {
        setSettingClicked(false);
    };

    const handleMenuOpenChange = (open: boolean) => {
        setIsMenuOpen(open);
        if (open) {
            window.scrollTo({ top: 0 });
        }
    };

    return (
        <>
            <UserSetting isOpen={isSettingsClick} handleUserSettingsClose={handleUserSettingsClose} />

            <Navbar maxWidth="2xl" position="sticky" onMenuOpenChange={handleMenuOpenChange} isMenuOpen={isMenuOpen} >
                <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
                    <NavbarBrand as="li" className="gap-3 max-w-fit">
                        <NextLink className="flex justify-start items-center gap-1" href={isNative ? "/dashboard" : "/"}>
                            <Logo />
                            <p className="font-bold text-foreground" >Leben</p>
                            <p className="font-bold text-red-500"> in </p>
                            <p className="font-bold text-yellow-400">Deutschland </p>
                        </NextLink>
                        {
                            !isNative &&
                            <NextLink className="md:flex" href="/dashboard" aria-label="dashboard">
                                <Tooltip content={t.nav_dashboard}>
                                    <DashboardIcon className="text-default-500" />
                                </Tooltip>
                                <p className="hidden md:flex text-foreground">{t.nav_dashboard}</p>
                            </NextLink>
                        }
                    </NavbarBrand>
                </NavbarContent>
                <NavbarContent className="hidden sm:flex basis-1/5 sm:basis-full" justify="end">
                    <Link isExternal className="hidden md:flex" href={siteConfig.links.github} aria-label="Github">
                        <GithubIcon className="text-default-500" />
                    </Link>
                    <Link className="hidden md:flex" isExternal href={siteConfig.links.bitesinbyte} aria-label="bitesinbyte">
                        <BitesInByteIcon className="text-default-500" />
                    </Link>
                    <Link isExternal className="hidden md:flex gap-1 items-center" href={isNative ? `${siteConfig.links.website}/#bamf-evaluation` : "/#bamf-evaluation"} aria-label={t.nav_bamf_evaluation}>
                            <ClipboardStatusIcon size={20} className="text-default-500" />
                            <p className="text-foreground text-sm">{t.nav_bamf_evaluation}</p>
                        </Link>
                    <Button isIconOnly variant="light" aria-label={t.settings} startContent={<SettingIcon />} onPress={handleSettingClick} className="dark:text-default-500" />
                    <ThemeSwitch translation={t} />
                    {
                        !isNative &&
                        <Link isExternal href={siteConfig.links.sponsor} className="gap-2">
                            <DonateIcon className="text-danger" />
                            <p className="hidden md:flex text-danger">{t.nav_donate}</p>
                        </Link>
                    }

                </NavbarContent>
                <NavbarContent className="sm:hidden basis-1" justify="end">
                    {
                        !isNative &&
                        <Link isExternal href={siteConfig.links.sponsor} className="gap-2">
                            <DonateIcon className="text-danger" />
                            <p className="hidden md:flex text-danger">{t.nav_donate}</p>
                        </Link>
                    }
                    <NavbarMenuToggle aria-label={isMenuOpen ? t.nav_close_menu : t.nav_open_menu} />
                </NavbarContent>
                <NavbarMenu>
                    <div className="mx-4 mt-2 flex flex-col gap-3">
                        <NavbarMenuItem>
                            <Link isExternal className="w-full p-4 flex justify-between items-center rounded-xl border-2 border-divider" href={siteConfig.links.github} aria-label="Github" onPress={() => setIsMenuOpen(false)}>
                                <GithubIcon className="text-foreground" />
                                <p className="font-bold text-foreground">GitHub</p>
                            </Link>
                        </NavbarMenuItem>
                        <NavbarMenuItem>
                            <Link className="w-full p-4 flex justify-between items-center rounded-xl border-2 border-divider" isExternal href={siteConfig.links.bitesinbyte} aria-label="bitesinbyte" onPress={() => setIsMenuOpen(false)}>
                                <BitesInByteIcon className="text-foreground" />
                                <p className="font-bold text-foreground">Bitesinbyte</p>
                            </Link>
                        </NavbarMenuItem>
                        <NavbarMenuItem>
                                <Link isExternal className="w-full p-4 flex justify-between items-center rounded-xl border-2 border-divider" href={isNative ? `${siteConfig.links.website}/#bamf-evaluation` : "/#bamf-evaluation"} aria-label={t.nav_bamf_evaluation} onPress={() => setIsMenuOpen(false)}>
                                    <ClipboardStatusIcon className="text-foreground" />
                                    <p className="font-bold text-foreground">{t.nav_bamf_evaluation}</p>
                                </Link>
                            </NavbarMenuItem>
                        <Divider />
                        <NavbarMenuItem>
                            <div className="w-full p-4 flex justify-between items-center rounded-xl border-2 border-divider">
                                <ThemeSwitch onThemeChange={() => setIsMenuOpen(false)} translation={t} />
                                <p className="font-bold text-foreground">{t.nav_switch_theme}</p>
                            </div>
                        </NavbarMenuItem>
                        <NavbarMenuItem>
                            <Link
                                onPress={handleSettingClick} className="w-full p-4 flex justify-between items-center rounded-xl border-2 border-divider cursor-pointer">
                                <SettingIcon className="text-foreground" />
                                <p className="font-bold text-foreground">{t.nav_my_settings}</p>
                            </Link>
                        </NavbarMenuItem>
                        <Divider />
                        <NavbarMenuItem>
                            <Link onPress={() => setIsMenuOpen(false)}
                                className="w-full p-4 flex justify-between items-center rounded-xl border-2 border-divider"
                                href="/privacy-policy" aria-label="privacy">
                                <ShieldIcon className="text-foreground" />
                                <p className="font-bold text-foreground">{t.nav_privacy_policy}</p>
                            </Link>
                        </NavbarMenuItem>
                        <NavbarMenuItem>
                            <Link className="w-full p-4 flex justify-between items-center rounded-xl border-2 border-divider" href="mailto:hello@bitesinbyte.com" target="_blank" aria-label="contact" onPress={() => setIsMenuOpen(false)}>
                                <MailIcon className="text-foreground" />
                                <p className="font-bold text-foreground">{t.nav_contact}</p>
                            </Link>
                        </NavbarMenuItem>
                    </div>
                </NavbarMenu>
            </Navbar >
        </>
    );
};