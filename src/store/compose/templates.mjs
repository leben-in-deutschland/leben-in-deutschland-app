// HTML templates for the framed store slides and the feature graphic. Every
// template is laid out on a 1080 px wide base canvas and scaled to the real
// output size by the renderer, so one design serves phones and tablets.

export const CAPTIONS = {
    de: {
        home: ["Dein Weg zum Einbürgerungstest", "Prüfungsreife, Lernserie und Tagesziel auf einen Blick"],
        practice: ["Alle offiziellen Fragen", "300 Fragen plus die 10 deines Bundeslandes – mit sofortigem Feedback und Erklärung"],
        translation: ["Übersetzt in 7 Sprachen", "Englisch, Türkisch, Russisch, Französisch, Arabisch, Ukrainisch und Hindi"],
        mock: ["Probeprüfung wie die echte", "33 Fragen, 60 Minuten und am Ende ein klares Ergebnis"],
        progress: ["Sieh, wie bereit du bist", "Prüfungsreife aus deinem Wissen und deinen Probeprüfungen"],
        streak: ["Bleib dran – jeden Tag", "Serie, Kalender und Meilensteine halten dich am Ball"],
        modes: ["Lernen, wie es zu dir passt", "Neue Fragen, Wiederholung, Fehler üben, schnelle Runde oder Marathon"],
        settings: ["Offline, privat, kostenlos", "Alle 16 Bundesländer, hell oder dunkel – deine Daten bleiben auf dem Gerät"],
    },
    en: {
        home: ["Your path to the Einbürgerungstest", "Exam readiness, streak, and daily goal at a glance"],
        practice: ["All official questions", "300 questions plus the 10 for your state – with instant feedback and an explanation"],
        translation: ["Translated into 7 languages", "English, Turkish, Russian, French, Arabic, Ukrainian, and Hindi"],
        mock: ["A mock exam like the real one", "33 questions, 60 minutes, and a clear result at the end"],
        progress: ["See how ready you are", "Readiness based on what you know and your mock exams"],
        streak: ["Keep going, every day", "Streaks, a calendar, and milestones keep you on track"],
        modes: ["Learn the way that suits you", "New questions, review, fix mistakes, quick round, or marathon"],
        settings: ["Offline, private, free", "All 16 federal states, light or dark – your data stays on your device"],
    },
};

export const FEATURE_COPY = {
    de: { title: "Leben in Deutschland", tagline: "Einbürgerungstest üben – alle offiziellen Fragen, offline und kostenlos" },
    en: { title: "Leben in Deutschland", tagline: "Practice for the Einbürgerungstest – all official questions, offline and free" },
};

const STATUS_ICONS = `
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>
<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="15" width="3.5" height="6" rx="1"/><rect x="7.5" y="11" width="3.5" height="10" rx="1"/><rect x="13" y="7" width="3.5" height="14" rx="1"/><rect x="18.5" y="3" width="3.5" height="18" rx="1"/></svg>
<svg width="30" height="22" viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="24" height="14" rx="3.5"/><rect x="4.5" y="7.5" width="19" height="9" rx="1.5" fill="currentColor" stroke="none"/><path d="M28 10v4" stroke-width="3"/></svg>`;

/** The in-app brand mark (components/shell/brand.tsx) with fixed brand colours. */
export function brandMarkSvg(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="5" y="2" width="22" height="28" rx="4.5" fill="#7A1F2E"/>
        <rect x="5.75" y="2.75" width="20.5" height="26.5" rx="3.75" fill="none" stroke="#D9B566" stroke-opacity="0.55" stroke-width="0.75"/>
        <circle cx="16" cy="13" r="5" fill="none" stroke="#D9B566" stroke-width="1.5"/>
        <circle cx="16" cy="13" r="2.25" fill="none" stroke="#D9B566" stroke-width="1"/>
        <path d="M11 22.5h10" stroke="#D9B566" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
}

function escape(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BASE_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #4E1019; }
    .canvas {
        position: relative; overflow: hidden; color: #FBF3E1;
        font-family: "Inter", system-ui, sans-serif;
        background:
            radial-gradient(120% 70% at 50% -10%, #9A3146 0%, #7A1F2E 42%, #4E1019 100%);
    }
    .glow {
        position: absolute; left: 50%; border-radius: 50%; transform: translateX(-50%);
        background: radial-gradient(closest-side, rgba(217,181,102,0.32), rgba(217,181,102,0) 72%);
        pointer-events: none;
    }
    .ring {
        position: absolute; border-radius: 50%; border: 2px solid rgba(217,181,102,0.22);
    }
    .ring.inner { border-width: 1.5px; opacity: .8; }
    .caption { position: absolute; left: 0; right: 0; text-align: center; padding: 0 70px; }
    .title {
        font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif; font-weight: 700;
        font-size: 64px; line-height: 1.1; letter-spacing: -0.02em; color: #FBF3E1; text-wrap: balance;
    }
    .subtitle { margin-top: 22px; font-size: 29px; line-height: 1.38; font-weight: 500; color: rgba(251,243,225,0.8); text-wrap: balance; }
    .device {
        position: absolute; left: 50%; transform: translateX(-50%);
        background: #17110F; border: 2px solid rgba(217,181,102,0.5);
        box-shadow: 0 50px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 2px #241A1C;
    }
    .screen { position: absolute; overflow: hidden; background: #140E10; }
    .screen img { display: block; width: 100%; height: auto; }
    .status {
        position: relative; display: flex; align-items: center; justify-content: space-between;
        color: rgba(255,255,255,0.92); font-weight: 600; font-size: 20px; letter-spacing: 0.01em;
    }
    .status .time { font-variant-numeric: tabular-nums; }
    .status .icons { display: flex; align-items: center; gap: 8px; }
    .status .icons svg { display: block; }
    .hole { position: absolute; left: 50%; transform: translateX(-50%); border-radius: 50%; background: #000; box-shadow: inset 0 0 0 2px #111; }
`;

/**
 * One framed slide. Geometry in base pixels; the renderer applies `scale`.
 * @param {object} p
 * @param {number} p.width - base canvas width (1080)
 * @param {number} p.height - base canvas height
 * @param {"phone"|"tablet"} p.device
 * @param {string} p.image - URL of the raw capture
 * @param {[number, number]} p.imageSize - natural size of the capture in CSS px (viewport)
 * @param {string} p.statusColor - background of the fake status bar
 * @param {string} p.title
 * @param {string} p.subtitle
 * @param {string} p.fontCss
 * @param {number} p.scale - output pixels per base pixel
 */
export function slideHtml(p) {
    const phone = p.device === "phone";
    const captionTop = Math.round(p.height * (phone ? 0.052 : 0.05));
    const captionBottom = captionTop + 290;
    const statusHeight = phone ? 54 : 44;
    const bezel = phone ? 16 : 26;
    const radiusOuter = phone ? 92 : 64;
    const radiusInner = radiusOuter - bezel + 2;
    // Screen width: as large as fits, keeping the whole app viewport visible
    // on the Play phone canvas and bleeding only the bottom bezel.
    const availableHeight = p.height - captionBottom - 40;
    const [vw, vh] = p.imageSize;
    const maxScreenWidth = phone ? 700 : 940;
    const fitWidth = Math.floor((availableHeight - statusHeight) * (vw / vh));
    const screenWidth = Math.min(maxScreenWidth, fitWidth);
    const imageHeight = Math.round(screenWidth * (vh / vw));
    const screenHeight = statusHeight + imageHeight;
    const frameWidth = screenWidth + bezel * 2;
    const frameHeight = screenHeight + bezel * 2;
    const spare = p.height - captionBottom - frameHeight;
    const frameTop = captionBottom + (spare > 80 ? Math.min(Math.round(spare / 2), 160) : 40);

    return `<!doctype html><html><head><meta charset="utf-8"><style>${p.fontCss}${BASE_CSS}
    html, body { width: ${p.width * p.scale}px; height: ${p.height * p.scale}px; overflow: hidden; }
    .canvas { width: ${p.width}px; height: ${p.height}px; transform: scale(${p.scale}); transform-origin: 0 0; }
    .glow { top: ${frameTop - 260}px; width: ${frameWidth + 520}px; height: ${frameWidth + 520}px; }
    .device { top: ${frameTop}px; width: ${frameWidth}px; height: ${frameHeight}px; border-radius: ${radiusOuter}px; }
    .screen { left: ${bezel}px; top: ${bezel}px; width: ${screenWidth}px; height: ${screenHeight}px; border-radius: ${radiusInner}px; }
    .status { height: ${statusHeight}px; padding: 0 ${phone ? 34 : 30}px; background: ${p.statusColor}; }
    .hole { top: ${Math.round(statusHeight / 2 - 9)}px; width: 18px; height: 18px; }
    .caption { top: ${captionTop}px; }
    </style></head><body><div class="canvas">
        <div class="ring" style="width:620px;height:620px;right:-300px;top:-240px"></div>
        <div class="ring inner" style="width:470px;height:470px;right:-225px;top:-165px"></div>
        <div class="glow"></div>
        <div class="caption">
            <h1 class="title">${escape(p.title)}</h1>
            <p class="subtitle">${escape(p.subtitle)}</p>
        </div>
        <div class="device"><div class="screen">
            <div class="status"><span class="time">10:08</span>${phone ? '<span class="hole"></span>' : ""}<span class="icons">${STATUS_ICONS}</span></div>
            <img src="${p.image}" width="${screenWidth}" height="${imageHeight}" alt="">
        </div></div>
    </div></body></html>`;
}

/** The 1024×500 Play feature graphic: mark, name, tagline, and the home screen in a tilted frame. */
export function featureGraphicHtml({ lang, image, imageSize, statusColor, fontCss }) {
    const copy = FEATURE_COPY[lang];
    const [vw, vh] = imageSize;
    const screenWidth = 300;
    const imageHeight = Math.round(screenWidth * (vh / vw));
    const bezel = 10;
    const statusHeight = 26;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}${BASE_CSS}
    html, body { width: 1024px; height: 500px; overflow: hidden; }
    .canvas { width: 1024px; height: 500px; }
    .glow { top: -120px; left: auto; right: -160px; transform: none; width: 760px; height: 760px; }
    .brand { position: absolute; left: 64px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
    .lockup { display: flex; align-items: center; gap: 18px; }
    .lockup svg { flex: none; }
    .name { font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif; font-weight: 800; font-size: 52px; letter-spacing: -0.025em; line-height: 1.05; color: #FBF3E1; }
    .tag { font-size: 24px; line-height: 1.4; font-weight: 500; color: rgba(251,243,225,0.84); max-width: 520px; }
    .pills { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
    .pill { font-size: 16px; font-weight: 600; padding: 7px 14px; border-radius: 999px; border: 1.5px solid rgba(217,181,102,0.55); color: #F0D89A; }
    .device { left: auto; right: -40px; top: 58px; transform: rotate(-8deg); transform-origin: top left; width: ${screenWidth + bezel * 2}px; height: ${imageHeight + statusHeight + bezel * 2}px; border-radius: 44px; }
    .screen { left: ${bezel}px; top: ${bezel}px; width: ${screenWidth}px; height: ${imageHeight + statusHeight}px; border-radius: 36px; }
    .status { height: ${statusHeight}px; padding: 0 18px; font-size: 11px; background: ${statusColor}; }
    .status .icons { gap: 4px; transform: scale(0.55); transform-origin: right center; }
    .hole { top: ${statusHeight / 2 - 4}px; width: 8px; height: 8px; }
    </style></head><body><div class="canvas">
        <div class="ring" style="width:520px;height:520px;right:120px;top:-230px"></div>
        <div class="glow"></div>
        <div class="brand">
            <div class="lockup">${brandMarkSvg(64)}<div class="name">${escape(copy.title)}</div></div>
            <p class="tag">${escape(copy.tagline)}</p>
            <div class="pills">${(lang === "de" ? ["16 Bundesländer", "7 Sprachen", "Probeprüfung"] : ["16 states", "7 languages", "Mock exam"]).map((t) => `<span class="pill">${escape(t)}</span>`).join("")}</div>
        </div>
        <div class="device"><div class="screen">
            <div class="status"><span class="time">10:08</span><span class="hole"></span><span class="icons">${STATUS_ICONS}</span></div>
            <img src="${image}" width="${screenWidth}" height="${imageHeight}" alt="">
        </div></div>
    </div></body></html>`;
}

/** Product page header / search results asset for the App Store (no prices, no platforms, no URLs - Apple's asset rules). */
export const CREATIVE_COPY = {
    de: { title: "Dein Weg zum Einbürgerungstest", subtitle: "Alle offiziellen Fragen, Probeprüfung wie die echte, offline" },
    en: { title: "Your path to the Einbürgerungstest", subtitle: "All official questions, a mock exam like the real one, offline" },
};

export const VIDEO_COPY = {
    de: {
        tagline: "Dein Weg zum Einbürgerungstest",
        intro: "Alle offiziellen Fragen · Probeprüfung · offline und kostenlos",
        outroTitle: "Jetzt kostenlos laden",
        outroSubtitle: "Im Google Play Store",
        site: "lebenindeutschland.org",
    },
    en: {
        tagline: "Your path to the Einbürgerungstest",
        intro: "All official questions · mock exam · offline and free",
        outroTitle: "Download for free",
        outroSubtitle: "On Google Play",
        site: "lebenindeutschland.org",
    },
};

/**
 * A landscape (1920×1080) video scene: caption on the left, framed phone on the
 * right. `captionLeft` and `deviceTop` (CSS px) move both inside a safe area,
 * e.g. for the App Store creative asset whose 21:9 and 3:2 crops keep only the
 * centre.
 */
export function videoLandscapeHtml(p) {
    const [vw, vh] = p.imageSize;
    const bezel = 14;
    const statusHeight = 46;
    const screenWidth = 420;
    const imageHeight = Math.round(screenWidth * (vh / vw));
    const captionLeft = p.captionLeft ?? 150;
    const deviceTop = p.deviceTop ?? 110;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${p.fontCss}${BASE_CSS}
    html, body { width: 1920px; height: 1080px; overflow: hidden; }
    .canvas { width: 1920px; height: 1080px; }
    .glow { top: -80px; left: auto; right: 60px; transform: none; width: 1000px; height: 1000px; }
    .caption { left: ${captionLeft}px; right: auto; top: 0; bottom: 0; width: 900px; padding: 0; text-align: left; display: flex; flex-direction: column; justify-content: center; }
    .title { font-size: 84px; }
    .subtitle { font-size: 38px; margin-top: 30px; max-width: 820px; }
    .device { left: auto; right: 240px; top: ${deviceTop}px; transform: none; width: ${screenWidth + bezel * 2}px; height: ${imageHeight + statusHeight + bezel * 2}px; border-radius: 70px; }
    .screen { left: ${bezel}px; top: ${bezel}px; width: ${screenWidth}px; height: ${imageHeight + statusHeight}px; border-radius: 58px; }
    .status { height: ${statusHeight}px; padding: 0 28px; font-size: 17px; background: ${p.statusColor}; }
    .status .icons { transform: scale(0.85); transform-origin: right center; }
    .hole { top: ${Math.round(statusHeight / 2 - 7)}px; width: 14px; height: 14px; }
    </style></head><body><div class="canvas">
        <div class="ring" style="width:700px;height:700px;right:-120px;top:-330px"></div>
        <div class="ring inner" style="width:540px;height:540px;right:-40px;top:-250px"></div>
        <div class="glow"></div>
        <div class="caption">
            <h1 class="title">${escape(p.title)}</h1>
            <p class="subtitle">${escape(p.subtitle)}</p>
        </div>
        <div class="device"><div class="screen">
            <div class="status"><span class="time">10:08</span><span class="hole"></span><span class="icons">${STATUS_ICONS}</span></div>
            <img src="${p.image}" width="${screenWidth}" height="${imageHeight}" alt="">
        </div></div>
    </div></body></html>`;
}

/** Intro or outro card for the promo video, in either orientation. */
export function videoCardHtml({ lang, width, height, kind, fontCss }) {
    const copy = VIDEO_COPY[lang];
    const portrait = height > width;
    const title = kind === "intro" ? "Leben in Deutschland" : copy.outroTitle;
    const line = kind === "intro" ? copy.tagline : copy.outroSubtitle;
    const small = kind === "intro" ? copy.intro : copy.site;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}${BASE_CSS}
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
    .canvas { width: ${width}px; height: ${height}px; display: flex; align-items: center; justify-content: center; }
    .glow { top: 50%; transform: translate(-50%, -50%); width: ${Math.round(Math.min(width, height) * 1.1)}px; height: ${Math.round(Math.min(width, height) * 1.1)}px; }
    .card { position: relative; text-align: center; padding: 0 ${portrait ? 90 : 160}px; display: flex; flex-direction: column; align-items: center; gap: ${portrait ? 34 : 28}px; }
    .card svg { filter: drop-shadow(0 30px 60px rgba(0,0,0,0.45)); }
    .name { font-family: "Plus Jakarta Sans", "Inter", system-ui, sans-serif; font-weight: 800; font-size: ${portrait ? 92 : 96}px; letter-spacing: -0.025em; line-height: 1.05; color: #FBF3E1; text-wrap: balance; }
    .line { font-size: ${portrait ? 42 : 40}px; font-weight: 600; color: #F0D89A; line-height: 1.3; text-wrap: balance; }
    .small { font-size: ${portrait ? 32 : 30}px; font-weight: 500; color: rgba(251,243,225,0.78); line-height: 1.4; text-wrap: balance; }
    .badge { margin-top: ${portrait ? 24 : 16}px; display: inline-flex; align-items: center; gap: 16px; padding: 18px 34px; border-radius: 999px; background: rgba(0,0,0,0.35); border: 1.5px solid rgba(217,181,102,0.5); font-size: 30px; font-weight: 600; color: #FBF3E1; }
    .badge svg { filter: none; }
    </style></head><body><div class="canvas">
        <div class="ring" style="width:${Math.round(width * 0.55)}px;height:${Math.round(width * 0.55)}px;right:-${Math.round(width * 0.2)}px;top:-${Math.round(width * 0.22)}px"></div>
        <div class="ring inner" style="width:${Math.round(width * 0.42)}px;height:${Math.round(width * 0.42)}px;left:-${Math.round(width * 0.16)}px;bottom:-${Math.round(width * 0.18)}px;top:auto"></div>
        <div class="glow"></div>
        <div class="card">
            ${brandMarkSvg(portrait ? 200 : 170)}
            <div class="name">${escape(title)}</div>
            <div class="line">${escape(line)}</div>
            ${kind === "intro"
                ? `<div class="small">${escape(small)}</div>`
                : `<div class="badge">${brandMarkSvg(40)}<span>${escape(small)}</span></div>`}
        </div>
    </div></body></html>`;
}
