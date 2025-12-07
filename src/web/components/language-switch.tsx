"use client";

import { Select, SelectItem } from "@heroui/react";
import { GermanFlagIcon } from "@/icons/GermanFlagIcon";
import { UnitedKingdomIcon } from "@/icons/UnitedKingdomIcon";
import { User } from "@/types/user";
import { useState } from "react";

export const LanguageSwitch = ({ user, handleAppLanguageChange }: { user: User | undefined, handleAppLanguageChange: any }) => {
    const [selectedLang, setSelectedLang] = useState(user?.appLanguage ?? "de");

    const handleSelectionChange = (e: any) => {
        const lang = e.target.value;
        setSelectedLang(lang);
        handleAppLanguageChange(lang);
    };

    return (
        <Select
            className="max-w-xs"
            selectedKeys={[selectedLang]}
            label="App Language"
            placeholder="Select App Language"
            startContent={selectedLang === "en" ? <UnitedKingdomIcon /> : <GermanFlagIcon />}
            onChange={handleSelectionChange}
        >
            <SelectItem key="de" startContent={<GermanFlagIcon />}>Deutsch</SelectItem>
            <SelectItem key="en" startContent={<UnitedKingdomIcon />}>English</SelectItem>
        </Select>
    );
};