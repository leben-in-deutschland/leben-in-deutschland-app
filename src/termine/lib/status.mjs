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

/** "Eventuell ist ein späterer Einstieg noch möglich": the centre itself says "ask us". */
const HEDGED = /(eventuell|ggf\.?|gegebenenfalls|unter umständen)[^.]{0,80}möglich/;
const CLOSED =
    /anmeldeschluss[^.]{0,40}(erreicht|abgelaufen|vorbei|überschritten|verstrichen)|anmelde(frist|phase|zeitraum)[^.]{0,40}(abgelaufen|beendet|vorbei|vorüber|verstrichen)|keine anmeldung(en)? mehr möglich|nicht mehr (buchbar|möglich|anmeldbar)|\babgeschlossen\b|\bbeendet\b|bereits (begonnen|gestartet)|hat begonnen|läuft bereits|\babgesagt\b|\bausgefallen\b|fällt aus|\bentfällt\b|\bstorniert\b|\babgelaufen\b/;
const SOON = /noch nicht (begonnen|möglich|buchbar|freigeschaltet|geöffnet)|anmeldung (ab|erst ab|möglich ab|startet|beginnt)\b|buchbar ab\b|anmeldestart|in planung|in vorbereitung/;
const WAITLIST = /warteliste|wartelisten|nachrück/;
const FEW = /fast (ausgebucht|belegt|voll)|wenige (freie )?(plätze|restplätze)|noch wenige|restpl[aä]tze|nur noch \d+ (plätze|platz|pl\.)/;
const FULL = /\bausgebucht\b|\bbelegt\b|keine (freien )?plätze|\b(ist |bereits |schon )?voll\b|\bausverkauft\b/;
/** A negation or a pointer to the course text: the page shows the date, not whether a place is left. */
const UNCLEAR =
    /\bnicht\b|\bkein(e|en|er)?\b|\bnur\b|persönlich|telefonisch|schriftlich|siehe (details|kurs|hinweis|beschreibung)|kursinfo|information|hinweise?\b|beachten|auf anfrage|vor ort|interessent/;
const FREE = /anmeldung (ist )?(noch )?möglich|\bbuchbar\b|plätze (sind )?(noch )?(frei|vorhanden|verfügbar)|freie plätze|noch plätze|noch frei\b|in den warenkorb|jetzt (anmelden|buchen)/;

/**
 * Status for a German status text ("Anmeldung möglich", "fast ausgebucht",
 * "Der Anmeldeschluss wurde bereits erreicht."). The order matters:
 * "ausgebucht, Warteliste möglich" is a waiting list, "fast ausgebucht" is
 * not full, and any negation keeps a text from counting as free. "Keine
 * Anmeldung möglich" is unknown, not closed: most centres take registrations
 * for this test in person, and their web shop says exactly that about it.
 */
export function statusFromText(text) {
    const value = String(text ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    if (!value || HEDGED.test(value)) {
        return "unknown";
    }
    if (CLOSED.test(value)) {
        return "closed";
    }
    if (SOON.test(value)) {
        return "soon";
    }
    if (WAITLIST.test(value)) {
        return "waitlist";
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
