'use client'
import {
    Navbar,
    NavbarContent,
    NavbarMenu,
    NavbarMenuToggle,
    NavbarBrand,
    NavbarItem,
    NavbarMenuItem,
} from "@nextui-org/navbar";
import { Button } from "@nextui-org/button";
import { Link, LinkIcon } from "@nextui-org/link";
import { signIn, signOut, useSession } from "next-auth/react"

import { siteConfig } from "../config/site";
import NextLink from "next/link";


import { ThemeSwitch } from "./theme-switch";
import { DonateIcon } from "../icons/DonateIcon";

import { Logo } from "../icons/Logo";
import { GithubIcon } from "../icons/GithubIcon";
import { BitesInByteIcon } from "@/icons/BitesInByteIcon";
import { Avatar, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@nextui-org/react";
import { useState } from "react";
import UserSetting from "./settings/user-setting";

export const NavigationBar = () => {
    const { data: session } = useSession()
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

            <Navbar maxWidth="xl" position="sticky">
                <NavbarContent className="basis-1/5" justify="start">
                    <NavbarBrand as="li" className="gap-3 max-w-fit">
                        <NextLink className="flex justify-start items-center gap-1" href="/">
                            <Logo />
                            <p className="font-bold dark:text-white" >Leben</p>
                            <p className="font-bold text-red-500"> in </p>
                            <p className="font-bold text-yellow-400">Deutschland </p>
                        </NextLink>
                    </NavbarBrand>
                </NavbarContent>

                <NavbarContent className="hidden sm:flex basis-1/5 sm:basis-full" justify="end">
                    <Link isExternal className="hidden md:flex" href={siteConfig.links.github} aria-label="Github">
                        <GithubIcon className="text-default-500" />
                    </Link>
                    <Link className="hidden md:flex" isExternal href={siteConfig.links.bitesinbyte} aria-label="bitesinbyte">
                        <BitesInByteIcon className="text-default-500" />
                    </Link>
                    <ThemeSwitch />
                    <Link isExternal as={Link} href={siteConfig.links.sponsor} className="gap-2">
                        <DonateIcon className="text-red-700" />
                        <p className="hidden md:flex text-red-700">Donate</p>
                    </Link>
                    {!session && <Button
                        color="primary"
                        variant="flat"
                        onPress={() => signIn("google")}>
                        Sign In
                    </Button>}
                    {session && <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <Avatar
                                isBordered
                                as="button"
                                className="transition-transform"
                                color="secondary"
                                name={session.user.name}
                                size="sm"
                                src={session.user.image}
                            />
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Profile Actions" variant="flat">
                            <DropdownItem key="profile" className="h-14 gap-2">
                                <p className="font-semibold dark:text-white">Signed in as</p>
                                <p className="font-semibold dark:text-white">{session.user.email}</p>
                            </DropdownItem>
                            <DropdownItem key="settings" onClick={handleSettingClick} className="dark:text-white">My Settings</DropdownItem>
                            <DropdownItem key="help_and_feedback" className="dark:text-white">Help & Feedback</DropdownItem>
                            <DropdownItem key="logout" className="text-red-500" color="danger" onPress={() => signOut()}>
                                Log Out
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>}

                </NavbarContent>
                <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
                    <Link isExternal as={Link} href={siteConfig.links.sponsor} className="gap-2">
                        <DonateIcon className="text-red-700" />
                        <p className="hidden md:flex text-red-700">Donate</p>
                    </Link>
                    <NavbarMenuToggle aria-label={isMenuOpen ? "Close menu" : "Open menu"} />
                </NavbarContent>
                <NavbarMenu>
                    <div className="mx-4 mt-2 flex flex-col gap-2">
                        {!session && <Button
                            color="primary"
                            variant="flat"
                            onPress={() => signIn("google")}>
                            Sign In
                        </Button>}
                        {session &&
                            <div>
                                <div className="flex justify-between">
                                    <div>
                                        <p className="font-semibold dark:text-white">Signed in as</p>
                                        <p className="font-semibold dark:text-white">{session.user.email}</p>
                                    </div>
                                    <div>
                                        <Avatar
                                            isBordered
                                            as="button"
                                            className="transition-transform"
                                            color="secondary"
                                            name={session.user.name}
                                            size="sm"
                                            src={session.user.image}
                                        />
                                    </div>
                                </div>

                            </div>
                        }
                        <Link isExternal className="md:flex" href={siteConfig.links.github} aria-label="Github">
                            <GithubIcon className="text-default-500" />
                            <p className="font-bold">GitHub</p>
                        </Link>
                        <Link className="md:flex" isExternal href={siteConfig.links.bitesinbyte} aria-label="bitesinbyte">
                            <BitesInByteIcon className="text-default-500" />
                            <p className="font-bold">Bitesinbyte</p>
                        </Link>
                        <div className="flex justify-between"><ThemeSwitch />           <p className="font-bold">Switch Theme</p></div>
                        <Button key="settings" onClick={handleSettingClick} className="dark:text-white">My Settings</Button>
                        <Button key="help_and_feedback" className="dark:text-white">Help & Feedback</Button>
                        <Button key="logout" className="dark:text-white" color="danger" onPress={() => signOut()}>
                            Log Out
                        </Button>
                    </div>
                </NavbarMenu>
            </Navbar >
        </>
    );
};