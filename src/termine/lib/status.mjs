// What a course page says about booking, reduced to the handful of states the
// app shows. The rule for every mapping: never say "free" unless the exam
// centre itself says a place can be booked. Anything unclear is "unknown" and
// the learner is sent to the centre's page.

/**
 * free     a place can be booked (online, in person or by phone)
 * few      bookable, and the centre says only a few places are left
 * waitlist full, but the centre takes names for a waiting list
 * full     no place and no waiting list
 * soon     the date is published, registration has not opened yet
 * closed   registration is over (deadline passed, test done, cancelled)
 * unknown  the page shows the date but not whether a place is left
 */
export const STATUSES = ["free", "few", "waitlist", "full", "soon", "closed", "unknown"];

/** Statuses that mean "a learner can get a place now". */
export const BOOKABLE = ["free", "few"];

/** How a place is booked, when the page says so. */
export const BOOKINGS = ["online", "inperson", "phone", "written"];

const MONTH_WORDS = "januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember";
const WEEKDAY_WORDS = "montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag";

/** "Eventuell ist ein späterer Einstieg noch möglich": the centre itself says "ask us". */
const HEDGED = /(eventuell|ggf\.?|gegebenenfalls|unter umständen)[^.]{0,80}möglich/;
const CLOSED =
    /anmeldeschluss(?![^.]{0,40}\bnicht\b)[^.]{0,40}(erreicht|abgelaufen|vorbei|überschritten|verstrichen)|anmelde(frist|phase|zeitraum)(?![^.]{0,40}\bnicht\b)[^.]{0,40}(abgelaufen|beendet|vorbei|vorüber|verstrichen)|keine anmeldung(en)? mehr möglich|nicht mehr (buchbar|möglich|anmeldbar)|\babgeschlossen\b|\bbeendet\b|bereits (begonnen|gestartet)|hat begonnen|läuft bereits|\babgesagt\b|\bausgefallen\b|fällt aus|\bentfällt\b|\bstorniert\b|\babgelaufen\b/;
/**
 * A day from which something counts: "ab 01.12.", "ab dem 1. Dezember",
 * "ab Mi., 25.11.", "ab Januar", "ab KW 3" - but not "ab sofort",
 * "ab 16 Jahren" or "ab 14 Uhr".
 */
const FROM_A_DAY = `\\bab (?:dem |den )?(?:(?:${WEEKDAY_WORDS})\\b|(?:mo|di|mi|do|fr|sa|so)\\.?,? ?(?=\\d)|\\d{1,2}\\.|(?:anfang |mitte |ende )?(?:${MONTH_WORDS})\\b|kw ?\\d)`;
const SOON = new RegExp(
    [
        "noch nicht (begonnen|möglich|buchbar|freigeschaltet|geöffnet|gestartet|anmeldbar)",
        "anmeldung (startet|beginnt|öffnet)\\b",
        "anmelde(start|beginn)",
        "in planung|in vorbereitung",
        "\\b(demnächst|in kürze)\\b",
        "\\bbald (wieder )?(buchbar|möglich|anmeldbar|verfügbar|freigeschaltet)",
        "\\berst (ab|am|im|zum|wieder|später)\\b",
        FROM_A_DAY,
    ].join("|"),
);
const WAITLIST = /warteliste|wartepl(ä|a)tz|nachrück/;
/** "Keine Warteliste", "Warteliste geschlossen": the word alone is no waiting list. */
const NO_WAITLIST = /\b(keine?|ohne) (\w+ )?wartelisten?\b|wartelisten?[^.]{0,20}\b(nicht|geschlossen|voll)\b/;
/** "0 freie Plätze", "Freie Plätze: 0": a count of none. */
const ZERO = /(?<![\d.,:])0 (freie[nr]? |verfügbare[nr]? )?(rest)?pl(ä|a)tz|\bplätze( frei| verfügbar| vorhanden)?: ?0(?![\d.,:]| ?(von|\/))/;
/** "3 von 12 Plätzen belegt": how many are taken, not that all are. */
const TAKEN = /(?<![\d.,:])(\d{1,3}) ?(?:von|\/) ?(\d{1,3}) (?:plätzen? )?(?:sind )?(?:belegt|besetzt|vergeben|gebucht)/;
/** A negation: whatever else the text says, it does not say that a place can be booked. */
const NEGATED = /\bkein(e|en|er|erlei)?\b|\bnicht\b|\bohne\b/;
/** "Noch nicht ausgebucht" is neither full nor a statement that can be booked on. */
const NOT_FULL = /\b(nicht|kein(e|en|er)?) (\w+ ){0,2}(ausgebucht|belegt|voll|ausverkauft)\b/;
const FEW =
    /fast (ausgebucht|belegt|voll)|\bwenige (freie )?(rest)?pl(ä|a)tze|\bwenige (sind )?(noch )?(frei|verfügbar|vorhanden)|\brestpl(ä|a)tz|nur noch \d+ (freie[nr]? )?(pl(ä|a)tz|pl\.)|nur noch (ein|einen|zwei|drei) (freie[nr]? )?pl(ä|a)tz/;
const FULL = /\bausgebucht\b|\bbelegt\b|\bkein(e|en)? (freie[nr]? )?(rest)?pl(ä|a)tz|\b(ist |bereits |schon )?voll\b|\bausverkauft\b/;
/**
 * A pointer to the course text or a condition: the page shows the date, not
 * whether a place is left. A day in the text is a condition too ("Anmeldung
 * möglich vom 01.12. bis 15.12." says nothing about today).
 */
const UNCLEAR = new RegExp(
    `\\bnur\\b|persönlich|telefonisch|schriftlich|siehe (details|kurs|hinweis|beschreibung)|kursinfo|information|hinweise?\\b|beachten|auf anfrage|vor ort|interessent|\\d{1,2}\\.\\s?\\d{1,2}\\.|\\b\\d{1,2}\\. ?(?:${MONTH_WORDS})`,
);
const FREE =
    /anmeldung (ist )?((ab sofort|jetzt|noch|weiterhin|online) )*möglich|\bbuchbar\b|\banmeldbar\b|\bplätze (sind )?(noch )?(frei|vorhanden|verfügbar)|\bfreie plätze|noch plätze|noch frei\b|in den warenkorb|jetzt (anmelden|buchen)/;

function normalise(text) {
    return String(text ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * What a text says about places, once it is known not to be over or not yet
 * open. The order matters: "ausgebucht, Warteliste möglich" is a waiting
 * list, a count of none and every negation come before any word that sounds
 * like a free place ("keine Restplätze", "0 freie Plätze"), and "fast
 * ausgebucht" is not full.
 */
function placesFromText(value) {
    if (WAITLIST.test(value) && !NO_WAITLIST.test(value)) {
        return "waitlist";
    }
    if (ZERO.test(value)) {
        return "full";
    }
    const taken = TAKEN.exec(value);
    if (taken) {
        return Number(taken[1]) >= Number(taken[2]) ? "full" : "unknown";
    }
    if (NEGATED.test(value)) {
        return !NOT_FULL.test(value) && FULL.test(value) ? "full" : "unknown";
    }
    if (FEW.test(value)) {
        return "few";
    }
    if (FULL.test(value)) {
        return "full";
    }
    if (UNCLEAR.test(value)) {
        return "unknown";
    }
    return FREE.test(value) ? "free" : "unknown";
}

/**
 * Status for a German status text ("Anmeldung möglich", "fast ausgebucht",
 * "Der Anmeldeschluss wurde bereits erreicht."). "Keine Anmeldung möglich"
 * is unknown, not closed: most centres take registrations for this test in
 * person, and their web shop says exactly that about it.
 */
export function statusFromText(text) {
    const value = normalise(text);
    if (!value || HEDGED.test(value)) {
        return "unknown";
    }
    if (CLOSED.test(value)) {
        return "closed";
    }
    if (SOON.test(value)) {
        return "soon";
    }
    return placesFromText(value);
}

const VERDICTS = ["full", "closed", "waitlist"];

/**
 * What a course title or a link's tooltip says about places
 * ("Einbürgerungstest - AUSGEBUCHT"): "full", "closed", "waitlist" or null.
 * Such a text can close a date, never open one - and a registration day it
 * mentions ("Anmeldung ab 25.11.") is no verdict at all.
 */
export function titleVerdict(text) {
    const value = normalise(text);
    if (!value || HEDGED.test(value)) {
        return null;
    }
    const status = CLOSED.test(value) ? "closed" : placesFromText(value);
    return VERDICTS.includes(status) ? status : null;
}

/** How to book, when a status text names it. */
export function bookingFromText(text) {
    const value = String(text ?? "").toLowerCase();
    if (/persönlich|vor ort|in der geschäftsstelle/.test(value)) {
        return "inperson";
    }
    if (/telefonisch|per telefon/.test(value)) {
        return "phone";
    }
    if (/schriftlich|per (post|e-?mail)/.test(value)) {
        return "written";
    }
    return null;
}

const CLOSED_STATES = ["registrationdeadlineexpired", "disabledafter1stdate", "disabledafternthcoursedate", "coursecompleted", "coursecancelled", "coursehidden"];
const BOOKING_OF_MODE = { bookable: "online", inperson: "inperson", byphone: "phone", written: "written" };

/**
 * Status for the booking classes of the ITEM course system
 * (`bk-inperson bk-av-enough bk-rs-notbookableonline`). The meanings are the
 * texts its own stylesheet shows for each combination, e.g.
 * `bk-notbookable bk-rs-registrationdeadlineexpired` = "Die Anmeldephase für
 * diesen Kurs ist bereits vorüber."
 */
export function statusFromBookingClasses(classes) {
    const names = new Set((classes ?? []).map((name) => String(name).toLowerCase().replace(/^bk-/, "")));
    const has = (name) => names.has(name);
    const state = [...names].find((name) => name.startsWith("rs-"))?.slice(3) ?? "";
    const mode = Object.keys(BOOKING_OF_MODE).find(has) ?? null;
    const booking = mode ? BOOKING_OF_MODE[mode] : null;

    if (CLOSED_STATES.includes(state)) {
        return { status: "closed", booking: null };
    }
    if (state === "registrationnotbegun") {
        return { status: "soon", booking };
    }
    if (has("waitinglist") || (has("bookable") && has("av-soldout"))) {
        return { status: "waitlist", booking: "online" };
    }
    if (has("av-soldout") || state === "soldoutnowaitinglist") {
        return { status: "full", booking: null };
    }
    if (state === "coursealreadystarted" && !has("bookable")) {
        return { status: "closed", booking: null };
    }
    // "Der Kurs ist nicht buchbar." and the modes without a seat count say nothing about places.
    if (!mode || state === "noparticipantsallowed" || has("av-disabled")) {
        return { status: "unknown", booking };
    }
    if (has("av-few")) {
        return { status: "few", booking };
    }
    if (has("av-enough")) {
        return { status: "free", booking };
    }
    return { status: "unknown", booking };
}
