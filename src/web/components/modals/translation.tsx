import { Question, QuestionTranslation } from "@/types/question";
import { Button, Modal, ModalBody, ModalContent, Image, ModalHeader, Select, SelectItem } from "@heroui/react";
import { useEffect, useState } from "react";

export const Translation = ({
    handleClose, isModelOpen, question }:
    {
        isModelOpen: boolean
        handleClose: any,
        question: Question
    }) => {
    const targetLanguages = [
        {
            langCode: 'en',
            displayName: 'English',
            img: "https://www.geonames.org/flags/x/gb.gif"
        },
        {
            langCode: 'tr',
            displayName: 'Türkçe',
            img: "https://www.geonames.org/flags/x/tr.gif"
        },
        {
            langCode: 'ru',
            displayName: 'Русский',
            img: "https://www.geonames.org/flags/x/ru.gif"
        },
        {
            langCode: 'fr',
            displayName: 'Français',
            img: "https://www.geonames.org/flags/x/fr.gif"
        },
        {
            langCode: 'ar',
            displayName: 'العربية',
            img: "https://www.flagsarenotlanguages.com/flags/arab_league.png"
        },
        {
            langCode: 'uk',
            displayName: 'Українська',
            img: "https://www.geonames.org/flags/x/ua.gif",
        },
        {
            langCode: 'hi',
            displayName: 'हिन्दी',
            img: "https://www.geonames.org/flags/x/in.gif",
        }
    ];

    const [currentLangTranslation, setCurrentLangTranslation] = useState<QuestionTranslation | null>(question.translation ? question.translation["en"] : null);
    const [currentLanguage, setCurrentLanguage] = useState<string>("en");
    useEffect(() => {
        if (question.translation) {
            setCurrentLangTranslation(question.translation[currentLanguage])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLanguage]);
    return (
        <Modal
            isOpen={isModelOpen}
            backdrop="transparent"
            isDismissable={true}
            hideCloseButton={false}
            onClose={handleClose}>
            <ModalContent>
                <ModalHeader className="dark:text-white">
                    <Select
                        items={targetLanguages}
                        multiple={false}
                        selectedKeys={[currentLanguage]}
                        className="w-1/2"
                        onChange={(e) => setCurrentLanguage(e.target.value)}
                    >
                        {(lang) => <SelectItem startContent={<Image src={lang.img} width={20} />} key={lang.langCode} className="dark:text-white">{lang.displayName}</SelectItem>}
                    </Select>
                </ModalHeader>
                <ModalBody>
                    <p className="dark:text-white"><span className="font-bold">{question?.num}.</span>  {currentLangTranslation?.question}</p>
                    <p className="dark:text-white"><span className="font-bold">A.</span>  {currentLangTranslation?.a}</p>
                    <p className="dark:text-white"><span className="font-bold">B.</span>  {currentLangTranslation?.b}</p>
                    <p className="dark:text-white"><span className="font-bold">C.</span>  {currentLangTranslation?.c}</p>
                    <p className="dark:text-white"><span className="font-bold">D.</span>  {currentLangTranslation?.d}</p>
                </ModalBody>
            </ModalContent>

        </Modal>
    );
};