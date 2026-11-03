// Minimal .xlsx reader on node:zlib for the exam-centre workbooks bamf.de
// publishes: the ZIP container, the sheet list, shared strings, and the
// cells of every sheet as strings. No external dependency - the daemon runs
// the data watch in a worktree without node_modules - and no XML parser:
// Excel writes each part on one line, so anchored regexes are enough.
import { inflateRawSync } from "node:zlib";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/** `&amp;`-style and numeric character references of XML text. */
export function decodeXml(text) {
    const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
    return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (whole, body) => {
        if (body[0] === "#") {
            return String.fromCodePoint(body[1] === "x" ? parseInt(body.slice(2), 16) : Number(body.slice(1)));
        }
        return named[body] ?? whole;
    });
}

/** Column letters of a cell reference -> zero-based index (A=0, Z=25, AA=26). */
export function columnIndex(reference) {
    let index = 0;
    for (const letter of reference.replace(/\d+$/, "")) {
        index = index * 26 + (letter.charCodeAt(0) - 64);
    }
    return index - 1;
}

/**
 * Lists the ZIP's entries as `Map<name, Buffer>`. The central directory at
 * the end is the authority on names, sizes and methods (local headers may
 * carry zeros when the writer streamed); the local header is read only to
 * skip its variable-length name and extra field.
 */
export function readZip(buffer) {
    if (buffer.length < 22 || buffer.readUInt16LE(0) !== 0x4b50) {
        throw new Error("not a ZIP file (no PK signature)");
    }
    // The end record is followed only by an optional comment of at most 64 KiB.
    let end = -1;
    for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 22 - 0xffff); offset--) {
        if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
            end = offset;
            break;
        }
    }
    if (end < 0) {
        throw new Error("not a ZIP file (no end-of-central-directory record)");
    }
    const count = buffer.readUInt16LE(end + 10);
    let offset = buffer.readUInt32LE(end + 16);
    const entries = new Map();
    for (let i = 0; i < count; i++) {
        if (buffer.readUInt32LE(offset) !== CENTRAL_HEADER) {
            throw new Error("corrupt ZIP central directory");
        }
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
        if (buffer.readUInt32LE(localOffset) !== LOCAL_HEADER) {
            throw new Error(`corrupt ZIP entry ${name}`);
        }
        const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const data = buffer.subarray(dataStart, dataStart + compressedSize);
        if (method === 0) {
            entries.set(name, data);
        } else if (method === 8) {
            entries.set(name, inflateRawSync(data));
        } else {
            throw new Error(`ZIP entry ${name} uses unsupported compression method ${method}`);
        }
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function part(entries, name) {
    const data = entries.get(name);
    return data ? data.toString("utf8") : "";
}

/** The visible text of a run of `<t>` elements; `<rPh>` phonetic guides are not text. */
function textOf(xml) {
    const runs = [];
    for (const match of xml.replace(/<rPh\b.*?<\/rPh>/gs, "").matchAll(/<t(?:\s[^>]*)?>(.*?)<\/t>/gs)) {
        runs.push(decodeXml(match[1]));
    }
    return runs.join("");
}

function sharedStrings(entries) {
    return Array.from(part(entries, "xl/sharedStrings.xml").matchAll(/<si>(.*?)<\/si>/gs), (match) => textOf(match[1]));
}

function cellValue(attributes, body, strings) {
    const type = /\bt="([^"]*)"/.exec(attributes)?.[1];
    if (type === "s") {
        return strings[Number(/<v>(.*?)<\/v>/s.exec(body)?.[1])] ?? "";
    }
    if (type === "inlineStr") {
        return textOf(body);
    }
    // Numbers, booleans, formula strings: the stored text is what the app needs.
    return decodeXml(/<v>(.*?)<\/v>/s.exec(body)?.[1] ?? "");
}

function readSheet(xml, strings) {
    const rows = [];
    // Rows and cells are either self-closing (empty) or wrap their content.
    for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>(.*?)<\/row>)/gs)) {
        const cells = [];
        for (const cell of (row[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
            const reference = /\br="([A-Z]+)\d+"/.exec(cell[1]);
            if (!reference || cell[2] === undefined) {
                continue;
            }
            const index = columnIndex(reference[1]);
            while (cells.length < index) {
                cells.push("");
            }
            cells[index] = cellValue(cell[1], cell[2], strings);
        }
        rows.push({ hidden: /\bhidden="(1|true)"/.test(row[1]), cells });
    }
    return rows;
}

/**
 * Reads a workbook into `{ sheets: [{ name, rows: [{ hidden, cells }] }] }`
 * in the sheet order of the workbook; cells are strings indexed by column,
 * gaps are empty strings. Only what the exam-centre lists need: no styles,
 * dates, or formulas.
 */
export function readWorkbook(buffer) {
    const entries = readZip(buffer);
    const strings = sharedStrings(entries);
    const targets = new Map();
    for (const rel of part(entries, "xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        const id = /\bId="([^"]*)"/.exec(rel[1])?.[1];
        const target = /\bTarget="([^"]*)"/.exec(rel[1])?.[1];
        if (id && target) {
            targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
        }
    }
    const sheets = [];
    for (const sheet of part(entries, "xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)) {
        const name = decodeXml(/\bname="([^"]*)"/.exec(sheet[1])?.[1] ?? "");
        const id = /\br:id="([^"]*)"/.exec(sheet[1])?.[1];
        const target = targets.get(id);
        if (!target) {
            throw new Error(`workbook sheet ${JSON.stringify(name)} has no worksheet part`);
        }
        sheets.push({ name, rows: readSheet(part(entries, target), strings) });
    }
    if (sheets.length === 0) {
        throw new Error("the file is a ZIP but not a workbook (no xl/workbook.xml sheets)");
    }
    return { sheets };
}
