"use client";

import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { VolumeIcon, VolumeOffIcon } from "@/components/ui/icons";
import type { Translations } from "@/utils/i18n";

async function loadSpeech() {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    return TextToSpeech;
}

type ListenButtonProps = {
    /** German text to read aloud. */
    text: string;
    t: Translations;
};

/** Reads the question aloud in German. Only rendered inside the Android app. */
export function ListenButton({ text, t }: ListenButtonProps) {
    const [speaking, setSpeaking] = useState(false);
    const startedRef = useRef(false);

    useEffect(
        () => () => {
            if (startedRef.current) {
                loadSpeech()
                    .then((speech) => speech.stop())
                    .catch(() => undefined);
            }
        },
        [],
    );

    const speak = async () => {
        try {
            const speech = await loadSpeech();
            startedRef.current = true;
            setSpeaking(true);
            await speech.speak({ text, lang: "de-DE", rate: 1, pitch: 1, volume: 1, category: "ambient" });
        } catch {
            /* No speech engine on this device: the button simply does nothing. */
        } finally {
            setSpeaking(false);
        }
    };

    const stop = async () => {
        try {
            const speech = await loadSpeech();
            await speech.stop();
        } catch {
            /* Nothing to stop. */
        } finally {
            setSpeaking(false);
        }
    };

    return (
        <Button
            variant="flat"
            size="sm"
            onPress={speaking ? stop : speak}
            aria-pressed={speaking}
            className="h-11 px-4 font-medium"
            startContent={speaking ? <VolumeOffIcon size={18} aria-hidden="true" /> : <VolumeIcon size={18} aria-hidden="true" />}
        >
            {speaking ? t.stop_speaking : t.read_aloud}
        </Button>
    );
}
