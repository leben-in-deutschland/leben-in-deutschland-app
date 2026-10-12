// Minimal PNG encoder on node:zlib for the images pdf.js decodes: RGB,
// RGBA, and 1-bit grayscale (expanded to RGB). No external dependency.
import { deflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** pdf.js ImageKind values. */
export const IMAGE_KIND = { GRAYSCALE_1BPP: 1, RGB_24BPP: 2, RGBA_32BPP: 3 };

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC_TABLE[n] = c;
}

function crc32(...buffers) {
    let crc = -1;
    for (const buffer of buffers) {
        for (const byte of buffer) {
            crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        }
    }
    return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeBytes = Buffer.from(type, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeBytes, data));
    return Buffer.concat([length, typeBytes, data, crc]);
}

/** Expands packed 1-bit grayscale rows (1 = white) to 8-bit RGB. */
function expandBilevel(data, width, height) {
    const rowBytes = Math.ceil(width / 8);
    const rgb = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
            const value = bit ? 255 : 0;
            const offset = (y * width + x) * 3;
            rgb[offset] = rgb[offset + 1] = rgb[offset + 2] = value;
        }
    }
    return rgb;
}

/** Encodes a decoded pdf.js image (`{ width, height, kind, data }`) as PNG. */
export function encodePng({ width, height, kind, data }) {
    let channels;
    let pixels;
    if (kind === IMAGE_KIND.RGBA_32BPP) {
        channels = 4;
        pixels = data;
    } else if (kind === IMAGE_KIND.RGB_24BPP) {
        channels = 3;
        pixels = data;
    } else if (kind === IMAGE_KIND.GRAYSCALE_1BPP) {
        channels = 3;
        pixels = expandBilevel(data, width, height);
    } else {
        throw new Error(`unsupported image kind ${kind}`);
    }
    const stride = width * channels;
    if (pixels.length < stride * height) {
        throw new Error(`image data too short: ${pixels.length} bytes for ${width}x${height}x${channels}`);
    }
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = channels === 4 ? 6 : 2;
    header[10] = 0;
    header[11] = 0;
    header[12] = 0;
    return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
