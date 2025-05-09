import { useEffect, useState } from "react";
import { Question } from "@/types/question";
import { Alert, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Image } from "@heroui/react";
import { SoundOffIcon } from "@/icons/SoundOffIcon";
import { SoundIcon } from "@/icons/SoundIcon";
import { remark } from 'remark';
import html from 'remark-html';

export const QuestionContext = ({
    handleClose, isModelOpen, question, translation }:
    {
        isModelOpen: boolean
        handleClose: any,
        question: Question,
        translation: any
    }) => {
    const targetLanguages = [
        { langCode: 'de', displayName: 'Deutsch', isoLangCode: 'de-DE', img: "https://www.geonames.org/flags/x/de.gif" },
        { langCode: 'en', displayName: 'English', isoLangCode: 'en-US', img: "https://www.geonames.org/flags/x/gb.gif" },
        { langCode: 'tr', displayName: 'Türkçe', isoLangCode: 'tr-TR', img: "https://www.geonames.org/flags/x/tr.gif" },
        { langCode: 'ru', displayName: 'Русский', isoLangCode: 'ru-RU', img: "https://www.geonames.org/flags/x/ru.gif" },
        { langCode: 'fr', displayName: 'Français', isoLangCode: 'fr-FR', img: "https://www.geonames.org/flags/x/fr.gif" },
        { langCode: 'ar', displayName: 'العربية', isoLangCode: 'ar-AE', img: "https://www.flagsarenotlanguages.com/flags/arab_league.png" },
        { langCode: 'uk', displayName: 'Українська', isoLangCode: 'uk-UA', img: "https://www.geonames.org/flags/x/ua.gif", },
        { langCode: 'hi', displayName: 'हिन्दी', isoLangCode: 'hi-IN', img: "https://www.geonames.org/flags/x/in.gif" }
    ];

    const [doesSupportLanguage, setDoesSupportLanguage] = useState<boolean>(true);
    const [currentQuestionContext, setCurrentQuestionContext] = useState<string | null>(question.context);
    const [currentLanguage, setCurrentLanguage] = useState<string>("de");
    const [currentIsoLanguage, setCurrentIsoLanguage] = useState<string>("de-DE");
    const [isCapacitorNative, setIsCapacitorNative] = useState<boolean>(false);
    const [TextToSpeech, setTextToSpeech] = useState<any>(null);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    useEffect(() => {
        (async () => {
            await stopSpeak();
            if (currentLanguage === "de") {
                const processedContent = await remark()
                    .use(html)
                    .process(question.context);
                const contentHtml = processedContent.toString();
                setCurrentQuestionContext(contentHtml);
                return;
            }
            if (question.translation) {
                const processedContent = await remark()
                    .use(html)
                    .process(question.translation[currentLanguage]?.context);
                const contentHtml = processedContent.toString();
                setCurrentQuestionContext(contentHtml);
            }
        })();
    }, [currentLanguage]);

    useEffect(() => {
        (async () => {
            if (typeof window !== "undefined") {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    setDoesSupportLanguage(true);
                    setIsCapacitorNative(true);
                    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
                    setTextToSpeech(TextToSpeech);
                }
            }
        })();
    }, []);

    useEffect(() => {
        if (!isCapacitorNative || !currentLanguage) return;
        (async () => {
            const targetLang = targetLanguages.find(lang => lang.langCode === currentLanguage);
            if (targetLang) {
                setCurrentIsoLanguage(targetLang.isoLangCode);
                try {
                    const { languages } = await TextToSpeech.getSupportedLanguages().then((res: any) => res);
                    setDoesSupportLanguage(languages.includes(targetLang.isoLangCode));
                } catch (error) {
                    console.error("Error fetching supported languages:", error);
                    setDoesSupportLanguage(false);
                }
            }
        })();
    }, [currentLanguage]);

    const speakText = async () => {
        if (!isCapacitorNative || !currentQuestionContext || !TextToSpeech) return;
        setIsSpeaking(true);
        await TextToSpeech.speak({
            text: currentQuestionContext,
            lang: currentIsoLanguage,
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            category: "ambient",
            queueStrategy: 1,
        });
    };

    const stopSpeak = async () => {
        if (!isCapacitorNative || !TextToSpeech) return;
        setIsSpeaking(false);
        await TextToSpeech.stop();
    };

    return (
        <Modal
            isOpen={isModelOpen}
            backdrop="transparent"
            isDismissable={true}
            hideCloseButton={false}
            onClose={handleClose}
        >
            <ModalContent>
                <ModalHeader className="dark:text-white flex justify-between mt-4">
                    <Select
                        items={targetLanguages}
                        multiple={false}
                        selectedKeys={[currentLanguage]}
                        className="w-1/2"
                        onChange={(e) => setCurrentLanguage(e.target.value)}
                    >
                        {(lang) => <SelectItem startContent={<Image src={lang.img} width={20} />} key={lang.langCode} className="dark:text-white">{lang.displayName}</SelectItem>}
                    </Select>
                    {doesSupportLanguage && isCapacitorNative && TextToSpeech && (
                        isSpeaking ?
                            <Button variant="light" isIconOnly startContent={<SoundOffIcon />} onPress={stopSpeak} />
                            : <Button variant="light" isIconOnly startContent={<SoundIcon />} onPress={speakText} />

                    )}
                </ModalHeader>
                <ModalBody>
                    <div className="dark:text-white" dangerouslySetInnerHTML={{ __html: currentQuestionContext ?? "" }} />
                </ModalBody>
                <ModalFooter>
                    <Alert
                        description={translation.ai_warning_description}
                        title={translation.ai_warning_title}
                        color="warning"
                        variant="bordered"
                    />
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};