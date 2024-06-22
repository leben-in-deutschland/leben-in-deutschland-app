// npx ts-node scripts/translation-question.ts

import {  Question, QuestionTranslation } from '@/types/question';


import fs from 'fs';
import path from 'path';
import questionsJson from '@/data/question.json';
// Replace with your Translator Text subscription key and endpoint
const subscriptionKey = 'e76ec3d15d8a4caa9733e66993f46729';
const endpoint = 'https://api.cognitive.microsofttranslator.com';
const location = 'northeurope';


// Function to translate text
async function translateText(inputs: { text: string }[], from: string, to: string[]): Promise<any[]> {
    const url = `${endpoint}/translate?api-version=3.0&${to.map(lang => `to=${lang}`).join('&')}`;

    const headers = {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Ocp-Apim-Subscription-Region': location,
        'Content-Type': 'application/json'
    };
    try {
          const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(inputs)
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error('Error translating text:', err);
        throw err;
    }
}

// Main function to process questions
async function processQuestions() {
    try {
        let questions = JSON.parse(JSON.stringify(questionsJson)) as Question[];
        const targetLanguages = ['en', 'tr', 'ru', 'fr', 'ar','uk','hi'];
        for (let i=0;i<questions.length;i++) {
            console.log(i)
            let question = questions[i];
            const translations: { [key: string]: QuestionTranslation } = {};
            const inputs = [
                { text: question.question },
                { text: question.a },
                { text: question.b },
                { text: question.c },
                { text: question.d }
            ];

            const translatedResults = await translateText(inputs, 'de', targetLanguages);
            for (const lang of targetLanguages) {
                translations[lang]= {
                    question: translatedResults[0].translations.find((t: any) => t.to === lang)?.text || '',
                    a: translatedResults[1].translations.find((t: any) => t.to === lang)?.text || '',
                    b: translatedResults[2].translations.find((t: any) => t.to === lang)?.text || '',
                    c: translatedResults[3].translations.find((t: any) => t.to === lang)?.text || '',
                    d: translatedResults[4].translations.find((t: any) => t.to === lang)?.text || '',
                };
            }
       
            questions[i].translation = translations;
        }
       // Define the directory and file path
       const dir = './data';
       const filePath = path.join(dir, 'question.json');

       // Ensure the directory exists
       if (!fs.existsSync(dir)) {
           fs.mkdirSync(dir);
       }
       // Write the JSON data to a file
       console.log('Updated Questions:', JSON.stringify(questions, null, 2));
        fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), { encoding: 'utf8' });
       console.log('JSON file has been created.');
        console.log('Questions processed and saved successfully.');
    } catch (err) {
        console.error('Error processing questions:', err);
    }
}


processQuestions();
