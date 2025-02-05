'use client'
import {
    Navbar,
    NavbarContent,
    NavbarMenu,
    NavbarMenuToggle,
    NavbarBrand,
    NavbarMenuItem,
} from "@heroui/navbar";
import { Tooltip } from "@heroui/react";
import { Button } from "@heroui/button";
import { Link, LinkIcon } from "@heroui/link";

import { siteConfig } from "../config/site";
import NextLink from "next/link";


import { ThemeSwitch } from "./theme-switch";
import { DonateIcon } from "../icons/DonateIcon";

import { Logo } from "../icons/Logo";
import { GithubIcon } from "../icons/GithubIcon";
import { BitesInByteIcon } from "@/icons/BitesInByteIcon";
import { useState } from "react";
import UserSetting from "./settings/user-setting";
import { SettingIcon } from "@/icons/SettingIcon";
import { DashboardIcon } from "@/icons/DashboardIcon";
import { Capacitor } from "@capacitor/core";

export const NavigationBar = () => {
    const [isSettingsClick, setSettingClicked] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleSettingClick = () => {
        setSettingClicked(true);
    };
    const handleUserSettingsClose = () => {
        setSettingClicked(false);
    };

    return (
        <>
            <UserSetting isOpen={isSettingsClick} handleUserSettingsClose={handleUserSettingsClose} />

            <Navbar maxWidth="2xl" position="sticky" onMenuOpenChange={setIsMenuOpen} >
                <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
                    <NavbarBrand as="li" className="gap-3 max-w-fit">
                        <NextLink className="flex justify-start items-center gap-1" href={Capacitor.isNativePlatform() ? "/dashboard" : "/"}>
                            <Logo />
                            <p className="font-bold dark:text-white" >Leben</p>
                            <p className="font-bold text-red-500"> in </p>
                            <p className="font-bold text-yellow-400">Deutschland </p>
                        </NextLink>
                        {
                            !Capacitor.isNativePlatform() &&
                            <NextLink className="md:flex" href="/dashboard" aria-label="dashboard">
                                <Tooltip content="Dashboard">
                                    <DashboardIcon className="text-default-500" />
                                </Tooltip>
                                <p className="hidden md:flex text-black dark:text-white">Dashboard</p>
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
                    <Button style={{ backgroundColor: 'transparent' }} isIconOnly variant="light" startContent={<SettingIcon />} onPress={handleSettingClick} className="dark:text-default-500" />
                    <ThemeSwitch />
                    {
                        !Capacitor.isNativePlatform() &&
                        <Link isExternal as={Link} href={siteConfig.links.sponsor} className="gap-2">
                            <DonateIcon className="text-red-700" />
                            <p className="hidden md:flex text-red-700">Donate</p>
                        </Link>
                    }

                </NavbarContent>
                <NavbarContent className="sm:hidden basis-1" justify="end">
                    {
                        !Capacitor.isNativePlatform() &&
                        <Link isExternal as={Link} href={siteConfig.links.sponsor} className="gap-2">
                            <DonateIcon className="text-red-700" />
                            <p className="hidden md:flex text-red-700">Donate</p>
                        </Link>
                    }
                    <NavbarMenuToggle aria-label={isMenuOpen ? "Close menu" : "Open menu"} />
                </NavbarContent>
                <NavbarMenu>
                    <div className="mx-4 mt-2 flex flex-col gap-2">
                        <Link isExternal className="text-2xl flex justify-between p-1 pl-4 pr-4 rounded-xl border-2 border-black dark:border-white" href={siteConfig.links.github} aria-label="Github">
                            <GithubIcon className="text-black dark:text-white" />
                            <p className="font-bold text-black dark:text-white">GitHub</p>
                        </Link>
                        <Link className="text-2xl flex justify-between p-1 pl-4 pr-4 rounded-xl border-2 border-black dark:border-white" isExternal href={siteConfig.links.bitesinbyte} aria-label="bitesinbyte">
                            <BitesInByteIcon className="text-black dark:text-white" />
                            <p className="font-bold text-black dark:text-white">Bitesinbyte</p>
                        </Link>
                        <div className="text-2xl flex justify-between p-1 pl-4 pr-4 rounded-xl border-2 border-black dark:border-white">
                            <ThemeSwitch />
                            <p className="font-bold text-black dark:text-white">Switch Theme</p>
                        </div>

                        <Link key="settings"
                            onPress={handleSettingClick} className="text-2xl dark:text-white-500 flex justify-between border-2 font-bold p-1 pl-4 pr-4 rounded-xl border-black dark:border-white">
                            <SettingIcon className="text-black dark:text-white" />
                            <p className="font-bold text-black dark:text-white">My Settings</p>
                        </Link>
                        <Link className="text-2xl flex justify-center p-1 pl-4 pr-4 rounded-xl border-2 border-black dark:border-white" href="/privacy-policy" aria-label="privacy">
                            <p className="font-bold text-black dark:text-white">Privacy Policy</p>
                        </Link>
                        <Link className="text-2xl flex justify-center p-1 pl-4 pr-4 rounded-xl border-2 border-black dark:border-white" href="mailto:hello@bitesinbyte.com" target="_blank" aria-label="contact">
                            <p className="font-bold text-black dark:text-white">Contact</p>
                        </Link>
                    </div>
                </NavbarMenu>
            </Navbar >
        </>
    );
};