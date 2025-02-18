import * as cheerio from 'cheerio';
import { Question, QuestionTranslation } from './types/question';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { Prüfstellen } from './types/prüfstellen';
import { createHash } from 'crypto';
import existingQuestionJson from './data/question.json';

const BASE_URL = 'https://www.einbuergerungstest-online.de';
const BASE_URL_BAMF = "https://www.bamf.de"

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
            translation: {},
            category: null,
            context: '',
            id: ''
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
            { text: question.d },
            { text: question.context }
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
                context: translatedResults[5].translations.find((t: any) => t.to === lang)?.text || ''
            };
        }
        question.translation = translations;
        return question;
    } catch (err) {
        console.error('Error processing questions:', err);
    }
};

const generateId = (question: Question) => {
    const text = question.question + question.a + question.b + question.c + question.d;
    const crypt = createHash('sha256').update(text).digest('hex')
    return crypt;
};

async function scrapeData() {
    try {
        const oldQuestion = JSON.parse(JSON.stringify(existingQuestionJson)) as Question[]
        let questions = await scrapAll();
        let stateQuestion = await scrapStates();
        const allQuestion = [...questions, ...stateQuestion];

        for (let i = 0; i < allQuestion.length; i++) {
            if (!allQuestion[i].question) {
                continue;
            }
            allQuestion[i].id = generateId(allQuestion[i]);
            const existing = oldQuestion.findIndex((q) => q && q.id === allQuestion[i].id);
            if (existing !== -1) {
                allQuestion[i].translation = oldQuestion[existing].translation;
                allQuestion[i].category = oldQuestion[existing].category;
                allQuestion[i].context = oldQuestion[existing].context;
            } else {
                allQuestion[i].category = await findCategory(allQuestion[i]);
                allQuestion[i].context = await getContext(allQuestion[i]);
                allQuestion[i] = await translate(allQuestion[i]);
            }
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
    } catch (error) {
        console.error('Error scraping data:', error);
    }
}

async function scrapPrüfstellenForState(stateCode: string): Promise<Prüfstellen[]> {
    let allPrüfstellen = [];
    const page = `${BASE_URL_BAMF}/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-${stateCode.toUpperCase()}.xlsx`;
    const $ = await cheerio.fromURL(page);
    let links = [];
    $('ul>li>a.c-link.c-link--download.c-link--desc.c-link--orient').each((_, element) => {
        const href = $(element).attr('href');
        const url = `${BASE_URL_BAMF}${href}`;
        links.push(url);
    });

    for (let i = 0; i < links.length; i++) {
        const resp = await fetch(links[i]);
        if (!resp.ok) {
            console.log(`Error fetching ${links[i]}`);
            continue;
        }
        const blob = await resp.blob();
        const text = await blob.arrayBuffer();
        const workbook = XLSX.read(text, { type: "binary" });

        for (let sheet in workbook.Sheets) {
            let worksheet = workbook.Sheets[sheet];
            let rows = XLSX.utils.sheet_to_json(worksheet, { raw: true, header: 1, blankrows: false, skipHidden: true, defval: "" });
            for (let i = 1; i < rows.length; i++) {
                const prüfstelle = {
                    regierungsbezirk: !rows[i][0] ? (rows[i][0] + " ") : "" + rows[i][1],
                    plz: rows[i][2],
                    ort: rows[i][3],
                    einrichtung: rows[i][4],
                    straße: rows[i][5],
                    telefon: rows[i][6],
                    email: rows[i][7],
                };
                allPrüfstellen.push(prüfstelle);
            }
        }
    }
    return allPrüfstellen;
}

async function scrapPrüfstellen() {
    try {
        let allPrüfstellen = [];
        for (let i = 0; i < STATES.length; i++) {
            const data = (await scrapPrüfstellenForState(STATES[i]))
                .filter((x) => (!x.regierungsbezirk.startsWith("Stand")))
                .filter((x) => x.einrichtung !== "");

            data.shift();

            allPrüfstellen.push({
                "stateCode": STATES[i], "data": data
            });
        }
        const dir = './data';
        const filePath = path.join(dir, 'prüfstellen.json');

        // Ensure the directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        // Write the JSON data to a file
        fs.writeFileSync(filePath, JSON.stringify(allPrüfstellen, null, 2), { encoding: 'utf8' });
        console.log(`Data scraped and saved to ${filePath}`);

    } catch (error) {
        console.error('Error scraping data:', error);
    }

}

async function getContext(question: Question) {
    const systemPromptTemplate = `You are given a task to find context for below question. \
    Give context so that it will help understand the question.\
    The generated text should not be more then 100 words.\
    <Question> \
        Question - ${question.question}\
        a:   ${question.a}\
        b:   ${question.b}\
        c:   ${question.c}\
        d:   ${question.d}\
    </Question>`;
    const url = process.env.AI_URL;
    const headers = {
        'api-key': process.env.AI_KEY,
        'Content-Type': 'application/json'
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "messages": [
                    {
                        "role": "user",
                        "content": systemPromptTemplate
                    }]
            })
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        const category = data.choices[0].message.content;
        console.log(`Fetched Context ${question.num}`);
        return category;
    } catch (err) {
        console.error('Error Category:', err);
        return "General";
    }
}

async function findCategory(question: Question): Promise<"Rights & Freedoms" |
    "Education & Religion" |
    "Law & Governance" |
    "Democracy & Politics" |
    "Economy & Employment" |
    "History & Geography" |
    "Elections" |
    "Press Freedom" |
    "Assembly & Protests" |
    "Federal System" |
    "Constitution" |
    "General"> {
    const systemPromptTemplate = `You are given a task to find category for below question. \
    Your response should be only category from below list.\
    'Rights & Freedoms', 'Education & Religion', 'Law & Governance',\
    'Democracy & Politics', 'Economy & Employment', 'History & Geography',\
    'Elections', 'Press Freedom', 'Assembly & Protests', 'Federal System', 'Constitution'\
    <Question> \
    Question - ${question.question}\
    a:   ${question.a}\
    b:   ${question.b}\
    c:   ${question.c}\
    d:   ${question.d}\
    </Question>`;
    const url = process.env.AI_URL;
    const headers = {
        'api-key': process.env.AI_KEY,
        'Content-Type': 'application/json'
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                "messages": [
                    {
                        "role": "user",
                        "content": systemPromptTemplate
                    }]
            })
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        const category = data.choices[0].message.content;
        console.log(`Found category for question ${question.num}: ${category}`);
        return category;
    } catch (err) {
        console.error('Error Category:', err);
        return "General";
    }
}

const scrapAllSources = async () => {
    await scrapeData();
    await scrapPrüfstellen();
};

scrapAllSources().then(() => {
    console.log('Scraping completed successfully');
    process.exit(0);
}).catch((err) => {
    console.error('Error scraping data:', err);
    process.exit(1);
});
