// npx ts-node scripts/copy-data/copy-data.ts

import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import { Question } from "@/types/question"
// URL of the text file on GitHub
const url = 'https://github.com/adalbero/LebenInDeutschland/raw/master/FragenSpider/out/questions-2023-12.txt';

// Function to fetch the text file and convert it to JSON
const fetchAndConvertToJson = async (url: string) => {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();

        // Den Buffer mit ISO-8859-1 dekodieren (often used for German text)
        const text = iconv.decode(Buffer.from(buffer), 'ISO-8859-1');

        // Check if the text is not empty
        if (!text) {
            throw new Error('Fetched text is empty');
        }
        // Split the text by lines
        const lines = text.split('\n').filter(line => line.trim() !== '');

        // Ensure there are lines to process
        if (lines.length < 2) {
            throw new Error('No data found in the fetched file');
        }

        // Extract the header (first line)
        const header = lines[0].split(';');

        // Ensure the header contains the expected columns
        if (header.length < 12) {
            throw new Error('Unexpected header format');
        }

        // Process each subsequent line
        const questions: Question[] = lines.slice(1).map(line => {
            const values = line.split(';');
            return {
                num: values[0],
                question: values[1],
                a: values[2],
                b: values[3],
                c: values[4],
                d: values[5],
                solution: values[6],
                area_code: values[7],
                area: values[8],
                theme: values[9],
                image: values[10],
                tags: values[11].split(','),
            };
        });

        // Define the directory and file path
        const dir = './data';
        const filePath = path.join(dir, 'question.json');

        // Ensure the directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        // Write the JSON data to a file
        fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), { encoding: 'utf8' });

        console.log('JSON file has been created.');
    } catch (error) {
        console.error('Error fetching or processing the file:', error);
    }
};

// Call the function
fetchAndConvertToJson(url);