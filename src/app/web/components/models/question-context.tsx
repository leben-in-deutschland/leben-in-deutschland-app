import { Question, QuestionTranslation } from "@/types/question";
import { Alert, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@heroui/react";
import { useEffect, useState } from "react";

export const QuestionContext = ({
    handleClose, isModelOpen, question }:
    {
        isModelOpen: boolean
        handleClose: any,
        question: Question
    }) => {
    const targetLanguages = [
        {
            langCode: 'de',
            displayName: 'Deutsch'
        },
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

    const [currentQuestionContext, setCurrentQuestionContext] = useState<string | null>(question.context);
    const [currentLanguage, setCurrentLanguage] = useState<string>("de");
    useEffect(() => {
        if (currentLanguage === "de") {
            setCurrentQuestionContext(question.context);
            return;
        }
        if (question.translation) {
            setCurrentQuestionContext(question.translation[currentLanguage]?.context)
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
                        {(lang) => <SelectItem key={lang.langCode} className="dark:text-white">{lang.displayName}</SelectItem>}
                    </Select>
                </ModalHeader>
                <ModalBody>
                    <p className="dark:text-white">{currentQuestionContext}</p>
                </ModalBody>
                <ModalFooter>
                    <Alert description="This article contains AI-generated text and may include errors. Please verify information and use your judgment." title="AI-Generated Content Disclaimer" color="warning" variant="bordered" />
                </ModalFooter>
            </ModalContent>

        </Modal>
    );
};