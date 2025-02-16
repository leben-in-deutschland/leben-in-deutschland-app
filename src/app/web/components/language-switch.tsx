"use client";

import { Select, SelectItem } from "@heroui/react";
import { GermanFlagIcon } from "@/icons/GermanFlagIcon";
import { UnitedKingdomIcon } from "@/icons/UnitedKingdomIcon";
import { User } from "@/types/user";

export const LanguageSwitch = ({ user, handleAppLanguageChange }: { user: User | undefined, handleAppLanguageChange: any }) => {

    const handleSelectionChange = (e: any) => {
        handleAppLanguageChange(e.target.value);
    };

    return (
        <Select
            className="max-w-xs"
            defaultSelectedKeys={[user?.appLanguage === "en" ? "en" : "de"]}
            label="App Language"
            placeholder="Select App Language"
            startContent={user?.appLanguage === "en" ? <UnitedKingdomIcon /> : <GermanFlagIcon />}
            onChange={handleSelectionChange}
        >
            <SelectItem key="de" startContent={<GermanFlagIcon />}>Deutsch</SelectItem>
            <SelectItem key="en" startContent={<UnitedKingdomIcon />}>English</SelectItem>
        </Select>
    );
};