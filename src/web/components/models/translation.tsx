import { Question, QuestionTranslation } from "@/types/question";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@nextui-org/react";
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
            displayName: 'English'
        },
        {
            langCode: 'tr',
            displayName: 'Türkçe'
        },
        {
            langCode: 'ru',
            displayName: 'Русский'
        },
        {
            langCode: 'fr',
            displayName: 'Français'
        },
        {
            langCode: 'ar',
            displayName: 'العربية'
        },
        {
            langCode: 'uk',
            displayName: 'Українська'
        },
        {
            langCode: 'hi',
            displayName: 'हिन्दी'
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
            backdrop="opaque"
            isDismissable={true}
            hideCloseButton={false}
            onClose={handleClose}
            classNames={{
                backdrop: "bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20"
            }}>
            <ModalContent>
                <ModalHeader className="dark:text-white">
                    <Select
                        items={targetLanguages}
                        multiple={false}
                        selectedKeys={[currentLanguage]}

                        onChange={(e) => setCurrentLanguage(e.target.value)}
                    >
                        {(lang) => <SelectItem key={lang.langCode} className="dark:text-white">{lang.displayName}</SelectItem>}
                    </Select>
                </ModalHeader>
                <ModalBody>
                    <p className="dark:text-white"><span className="font-bold">{question.num}.</span>  {currentLangTranslation?.question}</p>
                    <p className="dark:text-white"><span className="font-bold">A.</span>  {currentLangTranslation?.a}</p>
                    <p className="dark:text-white"><span className="font-bold">B.</span>  {currentLangTranslation?.b}</p>
                    <p className="dark:text-white"><span className="font-bold">C.</span>  {currentLangTranslation?.c}</p>
                    <p className="dark:text-white"><span className="font-bold">D.</span>  {currentLangTranslation?.d}</p>
                </ModalBody>
            </ModalContent>

        </Modal>
    );
};