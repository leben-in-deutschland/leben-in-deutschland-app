import * as cheerio from 'cheerio';
import { Question, QuestionTranslation } from './types/question';
import * as fs from 'fs';
import * as path from 'path';
const BASE_URL = 'https://www.einbuergerungstest-online.de';
const STATES = ["bb", "be", "bw", "by", "hb", "he", "hh", "mv", "ni", "nw", "rp", "sh", "sl", "sn", "st", "th"];
const TARGET_LANGUAGES = ['en', 'tr', 'ru', 'fr', 'ar', 'uk', 'hi'];
let questionsIndex = 0;
const mapIndexToChoice = (index: number) => {
    switch (index) {
        case 0:
            return 'a';
        case 1:
            return 'b';
        case 2:
            return 'c';
        case 3:
            return 'd';
        default:
            return '';
    }
};

const scrap = async (url: string, state: string) => {
    const questions: Question[] = [];
    const pageData = await cheerio.fromURL(url);
    console.log(`Scraping ${url} and found ${pageData('div.relative>div.p-4>div.mb-8').length} questions`);
    pageData('div.relative>div.p-4>div.mb-8').each((_, element) => {
        questionsIndex++;

        let num = questionsIndex.toString();
        if (state) {
            num = `${state.toUpperCase()}-${num}`;
        }
        let question: Question = {
            num: num,
            question: '',
            a: '',
            b: '',
            c: '',
            d: '',
            solution: '',
            image: '-',
            translation: {}
        };
        question.question = pageData(element).find("strong.font-semibold").text().trim();
        if (pageData(element).find("img").length > 0) {
            question.image = `${BASE_URL}${pageData(element).find("img").attr('src')}`;
        }
        pageData(element).find("ul>li.mb-2").each((index, element) => {
            if ((pageData(element).find("span.absolute.left-2").length > 0)) {
                question[mapIndexToChoice(index)] = pageData(element).find("span.absolute.left-2").remove().end().text().trim();
                question.solution = mapIndexToChoice(index);
            }
            else {
                question[mapIndexToChoice(index)] = pageData(element).text().trim();
            }
        });
        questions.push(question);
    });
    return questions;
};

const scrapStates = async () => {
    let questions: Question[] = [];
    for (let i = 0; i < STATES.length; i++) {
        questionsIndex = 0;
        const tempQuestions = await scrap(`${BASE_URL}/fragen/${STATES[i]}`, STATES[i]);
        questions = [...questions, ...tempQuestions];
    }
    return questions;
};

const scrapAll = async () => {
    let questions: Question[] = [];
    const links = [];
    const firstPage = `${BASE_URL}/fragen/1`
    const $ = await cheerio.fromURL(firstPage);
    $('div > nav:nth-of-type(2) a').each((_, element) => {
        const href = $(element).attr('href');
        links.push(href);
    });
    for (let i = 0; i < links.length; i++) {
        const tempQuestions = await scrap(links[i], "")
        questions = [...questions, ...tempQuestions];
    }
    return questions;
}

const translateText = async (inputs: { text: string }[], from: string, to: string[]) => {
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&${to.map(lang => `to=${lang}`).join('&')}`;
    console.log(`Translating text from ${from} to ${to.join(', ')}`);
    const headers = {
        'Ocp-Apim-Subscription-Key': process.env.TRANSLATOR_KEY || '',
        'Ocp-Apim-Subscription-Region': "swedencentral",
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

const translate = async (question: Question) => {
    try {
        console.log(`Translating question ${question.num}`);
        const translations: { [key: string]: QuestionTranslation } = {};
        const inputs = [
            { text: question.question },
            { text: question.a },
            { text: question.b },
            { text: question.c },
            { text: question.d }
        ];

        const translatedResults = await translateText(inputs, 'de', TARGET_LANGUAGES);
        for (const lang of TARGET_LANGUAGES) {
            console.log(`Translating to ${lang}`);
            translations[lang] = {
                question: translatedResults[0].translations.find((t: any) => t.to === lang)?.text || '',
                a: translatedResults[1].translations.find((t: any) => t.to === lang)?.text || '',
                b: translatedResults[2].translations.find((t: any) => t.to === lang)?.text || '',
                c: translatedResults[3].translations.find((t: any) => t.to === lang)?.text || '',
                d: translatedResults[4].translations.find((t: any) => t.to === lang)?.text || '',
            };
        }
        question.translation = translations;
        return question;
    } catch (err) {
        console.error('Error processing questions:', err);
    }
};

async function scrapeData() {
    try {

        let questions = await scrapAll();
        let stateQuestion = await scrapStates();
        const allQuestion = [...questions, ...stateQuestion];

        for (let i = 0; i < allQuestion.length; i++) {
            allQuestion[i] = await translate(allQuestion[i]);
        }

        const dir = './data';
        const filePath = path.join(dir, 'question.json');

        // Ensure the directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        // Write the JSON data to a file
        fs.writeFileSync(filePath, JSON.stringify(allQuestion, null, 2), { encoding: 'utf8' });
        console.log(`Data scraped and saved to ${filePath}`);
        process.exit(0);
    } catch (error) {
        console.error('Error scraping data:', error);
        process.exit(1);
    }
}

scrapeData();