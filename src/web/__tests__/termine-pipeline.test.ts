// @vitest-environment node
/*
 * src/termine/ reads the exam centres' own course pages (ADR-050): two
 * adapters (Kufer, ITEM), the rules that turn a page's words into a booking
 * state, and the sync that writes one file for the app. The fixtures are
 * shaped like the live pages of 2026-11; nothing here touches the network.
 *
 * The rule the tests protect first: a date is "free" only when the centre's
 * page says a place can be booked.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseItem } from "../../termine/adapters/item.mjs";
import { parseKufer } from "../../termine/adapters/kufer.mjs";
import { describeSite, examLinks, kuferSearchUrls, mergeSources, websitesOf } from "../../termine/discover.mjs";
import { isExamTitle, toSlots } from "../../termine/lib/courses.mjs";
import { berlinDay, findDate, findExamDay, findTime } from "../../termine/lib/dates.mjs";
import { firstText, innerText, openingTags, textOf } from "../../termine/lib/html.mjs";
import { decodeBody, getPage, sameSite } from "../../termine/lib/http.mjs";
import { isAllowed } from "../../termine/lib/robots.mjs";
import { statusFromBookingClasses, statusFromText, titleVerdict } from "../../termine/lib/status.mjs";
import { buildTermine, guardTermine, mergeCentre, readSource, STALE_DAYS, validateSources, validateTermine } from "../../termine/sync.mjs";

const TODAY = "2026-11-22";
const PAGE = "https://www.vhs-beispiel.de/kurssuche?kathaupt=26";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("German dates and times", () => {
    it("reads the formats the course pages print", () => {
        const read = (text: string) => {
            const day = findDate(text, 0, TODAY);
            const clock = day ? findTime(text, day.end) : null;
            return [day?.date ?? null, clock?.time ?? null, clock?.until ?? null];
        };
        expect(read("Fr. 27.11.2026 13:00 - 14:00 Uhr")).toEqual(["2026-11-27", "13:00", "14:00"]);
        expect(read("Do. 03.09.2026, 12.30 Uhr")).toEqual(["2026-09-03", "12:30", null]);
        expect(read("ab Mi., 10.02.2027, 14:30 Uhr")).toEqual(["2027-02-10", "14:30", null]);
        expect(read("Fr. 05.02.27, 10.30")).toEqual(["2027-02-05", "10:30", null]);
        expect(read("27. November 2026")).toEqual(["2026-11-27", null, null]);
    });

    it("does not take the day of a second date for a time, nor an impossible day for a date", () => {
        const text = "03.09.2026 - 05.09.2026, 9:00 Uhr";
        expect(findTime(text, findDate(text)?.end)?.time).toBe("09:00");
        expect(findDate("31.02.2026, dann 01.03.2026")?.date).toBe("2026-03-01");
    });

    it("reads a date without a year only when the weekday in front of it fits a nearby year", () => {
        expect(findDate("Sa. 28.11. 09:00 Uhr", 0, TODAY)?.date).toBe("2026-11-28");
        expect(findDate("Do. 14.01. 9.15 Uhr", 0, TODAY)?.date).toBe("2027-01-14");
        // 28 November is a Monday in none of 2025, 2026 and 2027: a guess could revive a finished exam.
        expect(findDate("Mo. 28.11. 09:00 Uhr", 0, TODAY)).toBeNull();
        expect(findDate("28.11. 09:00 Uhr", 0, TODAY)).toBeNull();
        expect(findDate("Sa. 28.11. 09:00 Uhr")).toBeNull();
    });

    it("takes neither a price nor an hour for the year, and not a weekday's first letters for another", () => {
        const day = (text: string) => findDate(text, 0, TODAY)?.date ?? null;
        // The fee column of a table row, and "10 Uhr" written close to the date.
        expect(day("Sa. 28.11. 30,00 €")).toBe("2026-11-28");
        expect(day("Sa. 28.11. 10 Uhr")).toBe("2026-11-28");
        expect(day("Sa. 28.11.10-12 Uhr")).toBe("2026-11-28");
        expect(day("Zeitraum: am 12.01.2027 Uhrzeit: 13:00")).toBe("2027-01-12");
        // "Sonnabend" is Saturday, and the "so" of "also" is no Sunday.
        expect(day("Sonnabend, 28.11. 10:00 Uhr")).toBe("2026-11-28");
        expect(day("Samstag, den 28.11. um 10 Uhr")).toBe("2026-11-28");
        expect(day("also 28.11. um 10 Uhr")).toBeNull();
        // Two digits are a year only when the weekday in front agrees; otherwise the day is not guessed.
        expect(day("Do. 05.02.26, 10:00")).toBe("2026-02-05");
        expect(day("Fr. 05.02.26, 10:00")).toBeNull();
    });

    it("reads a time with a dot only where it is one: not a room number, not another date", () => {
        const when = (text: string) => {
            const found = findExamDay(text, TODAY);
            return found ? [found.date, found.time, found.until] : null;
        };
        expect(when("Datum: Fr. 22.01.2027 Ort: vhs, Raum 1.12")).toEqual(["2027-01-22", null, null]);
        expect(when("Datum: Fr. 22.01.2027 Anmeldung bis 08.01. 12 Uhr")).toEqual(["2027-01-22", null, null]);
        expect(when("Fr. 22.01.2027 Raum 2.15 Uhrzeit: 13:00")).toEqual(["2027-01-22", "13:00", null]);
        expect(when("Fr. 22.01.2027, 8 - 9.30 Uhr")).toEqual(["2027-01-22", "08:00", "09:30"]);
        expect(when("Fr. 22.01.2027, 10 Uhr")).toEqual(["2027-01-22", "10:00", null]);
        expect(when("ab 25.01.2027 ,08:30 - 15:30 Uhr. Kursort: Schule")).toEqual(["2027-01-25", "08:30", "15:30"]);
        // The day twice: the time stands behind its second mention - unless the first one has it.
        expect(when("Einbürgerungstest - 11.12.2026 Fr., ab 11.12.2026 um 12:30 Uhr")).toEqual(["2026-12-11", "12:30", null]);
        expect(when("Kursbeginn: Mi. , 2.12.2026, 13:00 Uhr Kursende: Mi. , 2.12.2026, 14:00 Uhr")).toEqual(["2026-12-02", "13:00", null]);
    });

    it("tells the exam day from the days of registration", () => {
        const when = (text: string) => {
            const found = findExamDay(text, TODAY);
            return found ? [found.date, found.deadline] : null;
        };
        for (const deadline of ["Anmeldeschluss: Fr. 08.01.2027", "Anmeldeschluss ist der 08.01.2027.", "Anmeldung bis Fr., 08.01.2027", "Anmeldung bis einschließlich 08.01.2027,", "Anmeldungen sind bis zum 08.01.2027 möglich."]) {
            expect({ deadline, read: when(`${deadline} Datum: Fr. 22.01.2027 Uhrzeit: 13:00 Uhr`) }).toEqual({ deadline, read: ["2027-01-22", "2027-01-08"] });
        }
        // The day registration starts is not the exam either (a live page read 04.12. as the test day).
        expect(when("Persönliche Anmeldung erforderlich - ab 04.12.2026 möglich! Beginn: Fr. , 26.02.2027, 10:00 - 11:00 Uhr")).toEqual(["2027-02-26", null]);
        expect(when("Anmeldezeitraum: 01.11.2026 - 08.01.2027 Prüfung: 22.01.2027")).toEqual(["2027-01-22", "2027-01-08"]);
        expect(when("Anmeldung bis 08.01.2027")).toBeNull();
    });

    it("counts the day in Germany, whatever the machine's zone", () => {
        expect(berlinDay(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-23");
    });
});

describe("booking state from a centre's words", () => {
    it("says free only for a plain statement that a place can be booked", () => {
        for (const text of ["Anmeldung möglich", "Plätze frei", "Dieser Kurs ist buchbar"]) {
            expect({ text, status: statusFromText(text) }).toEqual({ text, status: "free" });
        }
    });

    it("keeps every negation, hedge and pointer to the course text at unknown", () => {
        for (const text of [
            "Keine Anmeldung möglich",
            "Keine Online-Anmeldung möglich",
            "Online-Anmeldung nicht möglich, siehe Details",
            "Dieser Kurs ist nicht buchbar und kann nicht in den Warenkorb hinzugefügt werden",
            "Anmeldung nur vor Ort",
            "Bitte Kursinfo beachten!",
            "Information zur Anmeldung/Buchung:",
            "Dieser Kurs hat bereits begonnen. Eventuell ist ein späterer Einstieg noch möglich.",
            "Eintritt frei",
            "",
        ]) {
            expect({ text, status: statusFromText(text) }).toEqual({ text, status: "unknown" });
        }
    });

    it("tells few, waiting list, full, not yet open and closed apart", () => {
        expect(statusFromText("fast ausgebucht")).toBe("few");
        expect(statusFromText("Kurs ausgebucht, Anmeldung auf Warteliste möglich")).toBe("waitlist");
        expect(statusFromText("Dieser Kurs ist leider schon voll, Warteliste ist aber möglich")).toBe("waitlist");
        expect(statusFromText("Kurs ausgebucht")).toBe("full");
        expect(statusFromText("Anmeldung möglich ab 01.12.")).toBe("soon");
        expect(statusFromText("Der Anmeldeschluss wurde bereits erreicht.")).toBe("closed");
        expect(statusFromText("Keine Anmeldung mehr möglich")).toBe("closed");
    });

    it("lets no negation, count of none or later day pass as a free place", () => {
        const expected: Record<string, string[]> = {
            full: ["Kurs ausgebucht - keine Restplätze", "Keine Restplätze mehr", "0 freie Plätze", "Freie Plätze: 0", "Ausgebucht, keine Warteliste"],
            unknown: ["Noch wenige Tage", "Keinerlei Anmeldung möglich", "Kurs ist noch nicht ausgebucht", "3 von 12 Plätzen belegt", "Anmeldung möglich vom 01.12. bis 15.12.", "Anmeldung ab 16 Jahren"],
            soon: ["Ab 01.12. buchbar", "Erst ab 01.12. buchbar", "Buchbar erst ab 01.12.", "Ab dem 01.12. Anmeldung möglich", "Demnächst buchbar", "Anmeldung ab Mi., 25.11. möglich"],
            waitlist: ["Warteplätze frei"],
            few: ["Nur noch 3 Plätze", "Restplätze vorhanden"],
            free: ["Anmeldung ab sofort möglich", "Noch 12 Plätze frei"],
        };
        for (const [status, texts] of Object.entries(expected)) {
            for (const text of texts) {
                expect({ text, status: statusFromText(text) }).toEqual({ text, status });
            }
        }
    });

    it("lets a title or a tooltip close a date but never open one", () => {
        expect(titleVerdict("Einbürgerungstest - AUSGEBUCHT")).toBe("full");
        expect(titleVerdict("Der Termin ist ausgebucht. Keine Anmeldung mehr möglich.")).toBe("closed");
        // The registration day in a title is no verdict, and does not hide one.
        expect(titleVerdict("Einbürgerungstest (Anmeldung ab 1.12.) - AUSGEBUCHT")).toBe("full");
        expect(titleVerdict("Einbürgerungstest Januar - persönliche Anmeldung ab Mi., 25.11. möglich")).toBeNull();
        expect(titleVerdict("Einbürgerungstest - Anmeldung möglich")).toBeNull();
    });

    it("reads ITEM's booking classes the way ITEM's own stylesheet words them", () => {
        const of = (classes: string) => statusFromBookingClasses(classes.split(" "));
        expect(of("bk-type-course bk-bookable bk-av-enough")).toEqual({ status: "free", booking: "online" });
        expect(of("bk-type-course bk-inperson bk-av-enough bk-rs-notbookableonline")).toEqual({ status: "free", booking: "inperson" });
        expect(of("bk-type-course bk-byphone bk-av-few bk-rs-notbookableonline")).toEqual({ status: "few", booking: "phone" });
        expect(of("bk-bookable bk-av-soldout")).toEqual({ status: "waitlist", booking: "online" });
        expect(of("bk-type-course bk-notbookable bk-av-soldout bk-rs-notbookableonline").status).toBe("full");
        expect(of("bk-notbookable bk-rs-registrationnotbegun").status).toBe("soon");
        expect(of("bk-inperson bk-av-soldout bk-rs-registrationdeadlineexpired").status).toBe("closed");
        // "Der Kurs ist nicht buchbar." says nothing about places, whatever the seat count behind it.
        expect(of("bk-type-course bk-notbookable bk-av-enough bk-rs-notbookableonline").status).toBe("unknown");
        expect(of("bk-notbookable bk-av-enough bk-rs-coursecompleted").status).toBe("closed");
    });
});

describe("HTML helpers", () => {
    it("reads text around a tag whose attribute holds markup", () => {
        const html = `<div class="k_ampel"><img src="/ampel.png" alt="Mehr unter <a href=https://x.de>Einbürgerungstest</a>."> &nbsp; </div><p>danach</p>`;
        expect(textOf(html)).toBe("danach");
        expect(innerText(html, html.indexOf(">") + 1)).toBe("");
    });

    it("stops at the element's own end and takes the first run of text for a title", () => {
        const html = `<a href="/k/1"><div> Einb&uuml;rgerungstest BAMF </div><div>Wann:</div><div>Mi., 10.02.2027</div></a><span>nicht mehr</span>`;
        const start = html.indexOf(">") + 1;
        expect(firstText(html, start)).toBe("Einbürgerungstest BAMF");
        expect(innerText(html, start)).toBe("Einbürgerungstest BAMF Wann: Mi., 10.02.2027");
    });
});

describe("HTML helpers on broken pages", () => {
    it("ends a comment the way a browser does and lets an unclosed script take the rest", () => {
        expect(textOf("vor <!-- <meta name=x> --!> sichtbar <!-- weg --> nach")).toBe("vor sichtbar nach");
        expect(textOf("<p>Text</p><script>var a = '<p>nie geschlossen'")).toBe("Text");
    });

    it("keeps a long attribute value inside its tag", () => {
        const html = `<p>vor</p><img src="data:image/png;base64,${"A".repeat(200_000)}" alt="x > y"><p>nach</p>`;
        expect(textOf(html)).toBe("vor nach");
    });

    it("does not let a page that never closes its tags stall the run", () => {
        const started = Date.now();
        for (const page of ['<a "'.repeat(80_000), "<a ".repeat(100_000), "<script ".repeat(40_000)]) {
            textOf(page);
            expect(openingTags(page, "a")).toEqual([]);
        }
        // 47 seconds for the first of these before the patterns were bounded; a few on a slow machine now.
        expect(Date.now() - started).toBeLessThan(20_000);
    }, 40_000);
});

const KUFER_CARDS = `
<div class="kw-kursuebersicht"><div id="kw-kursuebersicht-list">
<!-- H12E --><!-- B12A-->
  <div class="status-info "><img src="/fileadmin/kuferweb/webbasys/layout/kursampeln/trans.png" alt="Anmeldung m&ouml;glich" /> <span class="kw_ampel status1">Anmeldung m&ouml;glich</span></div>
  <div class="h-box"><h4 class="kw-kurstitel mb-4"><a href="/kurssuche/kurs/Einbuergerungstest/YCW44803" title="Einb&uuml;rgerungstest">Einb&uuml;rgerungstest</a></h4>
    <ul class="kw-kurs-properties">
      <li>Kursleitung: <span class="kw-kurs-properties-label">A. Beispiel</span></li>
      <li>Datum: <span class="kw-kurs-properties-label"><abbr title="Freitag">Fr.</abbr> 27.11.2026</span></li>
      <li>Uhrzeit: <span class="kw-kurs-properties-label">13:00 - 14:00 Uhr</span></li>
      <li>Ort: <span class="kw-kurs-properties-label">Calw, vhs, Raum 12</span></li>
    </ul>
    <div class="kw-kurs-preis h3">25,00 &euro;</div>
    <a href="/kurssuche/kurs/Einbuergerungstest/YCW44803" class="btn">weitere Details</a>
  </div>
<!-- B12E --><!-- B12A-->
  <div class="status-info "><span class="kw_ampel status7">Online-Anmeldung nicht m&ouml;glich, siehe Details</span></div>
  <div class="h-box"><h4 class="kw-kurstitel mb-4"><a href="/kurssuche/kurs/Einbuergerungstest/YCW44804">Einb&uuml;rgerungstest</a></h4>
    <ul class="kw-kurs-properties">
      <li>Datum: <span class="kw-kurs-properties-label"><abbr title="Freitag">Fr.</abbr> 22.01.2027</span></li>
      <li>Uhrzeit: <span class="kw-kurs-properties-label">13:00 - 14:00 Uhr</span></li>
      <li>Ort: <span class="kw-kurs-properties-label">Calw, vhs, Raum 12</span></li>
    </ul>
    Anmeldeschluss: 08.01.2027
  </div>
<!-- B12E -->
</div></div>`;

const KUFER_TABLE = `
<table class="kw-table"><thead><tr>
  <th id="kue-columnheader1">Status</th><th id="kue-columnheader2">Titel</th><th id="kue-columnheader3">Beginn</th><th id="kue-columnheader4">Ort</th><th id="kue-columnheader5">Nr.</th>
</tr></thead><tbody>
<tr class="clickable-row kw-table-row kw-kurstitel alt1" data-href="/veranstaltungssuche/kurs/Einbuergerungstest/262-479510">
  <td headers="kue-columnheader1"><span class="ampelicon nichtbuchbar" title="Der Anmeldeschluss wurde bereits erreicht."><i class="bi bi-clock" aria-label="Rotes Uhr-abgelaufen-Symbol"></i></span></td>
  <td headers="kue-columnheader2"><a href="/veranstaltungssuche/kurs/Einbuergerungstest/262-479510" title="Mehr Details zur Veranstaltung 'Einb&uuml;rgerungstest' öffnen">Einbürgerungstest</a> <!-- Titel --></td>
  <td headers="kue-columnheader3"><abbr title="Samstag">Sa.</abbr> 28.11. <!-- ohne Jahr --> <br> 09:00 Uhr</td>
  <td headers="kue-columnheader4">vhs, Saal</td>
  <td headers="kue-columnheader5" class="nr-column">25,00 &euro;</td>
</tr>
<tr class="clickable-row kw-table-row kw-kurstitel alt2" data-href="/veranstaltungssuche/kurs/Einbuergerungstest/262-479511">
  <td headers="kue-columnheader1"><span class="ampelicon" title="Dieser Kurs ist nicht buchbar und kann nicht in den Warenkorb hinzugefügt werden"><i class="bi bi-info-circle"></i></span></td>
  <td headers="kue-columnheader2"><a href="/veranstaltungssuche/kurs/Einbuergerungstest/262-479511">Einbürgerungstest</a></td>
  <td headers="kue-columnheader3"><abbr title="Donnerstag">Do.</abbr> 28.01.2027, <br> 16.00 Uhr</td>
  <td headers="kue-columnheader4">vhs im Schwarzen Kloster</td>
  <td headers="kue-columnheader5" class="nr-column">262-479511</td>
</tr>
</tbody></table>`;

const KUFER_ROWS = `
<!-- B12A-->
<div class="row kw-table-row alt1">
  <a href="https://www.vhs-beispiel.de/programm/kw/bereich/kursdetails/kurs/262-PE7/kursname/Einbuergerungstest BAMF/kategorie-id/0#inhalt" class="kw-kurstitel">
    <div class="col-sm-4"> Einb&uuml;rgerungstest BAMF </div>
    <div class="visible-xs kw-table-label">Wann:</div><div class="kw-table-data"> ab <abbr title="Mittwoch">Mi.</abbr>, 10.02.2027, 14:30 Uhr &nbsp;</div>
    <div class="visible-xs kw-table-label">Wo:</div><div class="kw-table-data">Kirchheim</div>
    <div class="visible-xs kw-table-label">Nr.:</div><div class="kw-table-data">262-PE7&nbsp;</div>
  </a>
  <div class="visible-xs kw-table-label">Status:</div>
  <div class="kw-table-data k_ampel"><img src="/fileadmin/kuferweb/webbasys/layout/kursampeln/trans.png" alt="Weitere Informationen zur Anmeldung finden Sie unter <a href=https://www.vhs-beispiel.de/news>Einbürgerungstest</a>." title="x"> &nbsp;</div>
  <div class="col-sm-1"><div class="ampelbutton nicht_buchbar" title="Weitere Informationen zur Anmeldung finden Sie unter <a href=https://www.vhs-beispiel.de/news>Einbürgerungstest</a>."></div></div>
</div>
<!-- B12E --><!-- B12A-->
<div class="row kw-table-row alt2">
  <a href="/programm/kurs/Einbuergerungstest-Januar/nr/27A100/bereich/details/" class="kw-kurstitel"><div class="col-sm-4">Einb&uuml;rgerungstest Januar - pers&ouml;nliche Anmeldung ab Mi., 25.11. m&ouml;glich</div>
    <div class="kw-table-label">Wann:</div><div class="kw-table-data"><abbr title="Mittwoch">Mi.</abbr>, 20.01.2027, 17:00 Uhr</div>
  </a>
  <div class="kw-table-data"><span class="kw_ampel status2">Pl&auml;tze frei</span></div>
</div>
<!-- B12E -->`;

describe("Kufer adapter", () => {
    it("reads the card template: status from the traffic light, day, time and place from their labels", () => {
        const { recognised, courses } = parseKufer(KUFER_CARDS, PAGE, { today: TODAY });
        expect(recognised).toBe(true);
        expect(courses).toHaveLength(2);
        expect(courses[0]).toMatchObject({
            id: "YCW44803",
            url: "https://www.vhs-beispiel.de/kurssuche/kurs/Einbuergerungstest/YCW44803",
            title: "Einbürgerungstest",
            date: "2026-11-27",
            time: "13:00",
            until: "14:00",
            status: "free",
            place: "Calw, vhs, Raum 12",
        });
        // The deadline is not the exam day, and "nicht möglich, siehe Details" is not a statement about places.
        expect(courses[1]).toMatchObject({ id: "YCW44804", date: "2027-01-22", deadline: "2027-01-08", status: "unknown" });
    });

    it("reads the table template: the row's data-href, a title text on the light, a date without a year, a time with a dot", () => {
        const { courses } = parseKufer(KUFER_TABLE, PAGE, { today: TODAY });
        expect(courses.map((course) => [course.id, course.date, course.time, course.status, course.place])).toEqual([
            ["262-479510", "2026-11-28", "09:00", "closed", "vhs, Saal"],
            ["262-479511", "2027-01-28", "16:00", "unknown", "vhs im Schwarzen Kloster"],
        ]);
        expect(courses[0].title).toBe("Einbürgerungstest");
    });

    it("reads the row template: markup inside an alt text, a title that carries another date, further link shapes", () => {
        const { courses } = parseKufer(KUFER_ROWS, PAGE, { today: TODAY });
        expect(courses).toHaveLength(2);
        expect(courses[0]).toMatchObject({ id: "262-PE7", title: "Einbürgerungstest BAMF", date: "2027-02-10", time: "14:30", status: "unknown", place: "Kirchheim" });
        expect(courses[0].url).toBe("https://www.vhs-beispiel.de/programm/kw/bereich/kursdetails/kurs/262-PE7/kursname/Einbuergerungstest%20BAMF/kategorie-id/0");
        // "Anmeldung ab Mi., 25.11." in the title is when registration starts; the exam is in January.
        expect(courses[1]).toMatchObject({ id: "27A100", date: "2027-01-20", time: "17:00", status: "free" });
    });

    it("names a registration deadline as that, whatever stands between the word and the day, and tidies the place", () => {
        const earlier = KUFER_CARDS.replace("Anmeldeschluss: 08.01.2027", "").replace(
            '<li>Datum: <span class="kw-kurs-properties-label"><abbr title="Freitag">Fr.</abbr> 22.01.2027</span></li>',
            '<li>Anmeldeschluss: <span class="kw-kurs-properties-label"><abbr title="Freitag">Fr.</abbr> 08.01.2027</span></li><li>Datum: <span class="kw-kurs-properties-label"><abbr title="Freitag">Fr.</abbr> 22.01.2027</span></li>',
        );
        expect(parseKufer(earlier, PAGE, { today: TODAY }).courses[1]).toMatchObject({ id: "YCW44804", date: "2027-01-22", time: "13:00", deadline: "2027-01-08" });

        // Some templates repeat the label for screen readers: "Wo:" and then ", Ort: …".
        const labelled = `<!-- B12A--><div class="row kw-table-row alt1"><a href="/programm/kurs/Einbuergerungstest/262-1243" class="kw-kurstitel"><div class="col-sm-4">Einb&uuml;rgerungstest</div>
            <div class="kw-table-label">Wann:</div><div class="kw-table-data">ab <abbr title="Freitag">Fr.</abbr> 29.01.2027, 13.00 Uhr</div>
            <div class="kw-table-label">Wo:</div><div class="kw-table-data"><span class="sr-only">, Ort: </span> vhs Salzburgerstr.19, EG&nbsp;</div></a>
            <div class="kw-table-data"><span class="kw_ampel status7">Keine Anmeldung m&ouml;glich</span></div></div><!-- B12E -->`;
        expect(parseKufer(labelled, PAGE, { today: TODAY }).courses[0]).toMatchObject({ date: "2027-01-29", time: "13:00", place: "vhs Salzburgerstr.19, EG" });
    });

    it("gives every course its own traffic light when the template's markers are missing", () => {
        const read = (html: string) => parseKufer(html, PAGE, { today: TODAY }).courses.map((course) => [course.id, course.date, course.time, course.status, course.place]);
        // The card template with its comments stripped: the light stands in front of the link.
        expect(read(KUFER_CARDS.replace(/<!--.*?-->/g, ""))).toEqual([
            ["YCW44803", "2026-11-27", "13:00", "free", "Calw, vhs, Raum 12"],
            ["YCW44804", "2027-01-22", "13:00", "unknown", "Calw, vhs, Raum 12"],
        ]);
        // The table with another row class: each row is its own course, light, date and place.
        expect(read(KUFER_TABLE.replaceAll("kw-table-row ", ""))).toEqual(read(KUFER_TABLE));
        expect(read(KUFER_TABLE)[0][3]).toBe("closed");
        // Three in a row, the light a sibling in front of each card: none takes its neighbour's.
        const card = (id: string, light: string, day: string) =>
            `<div class="status-info"><span class="kw_ampel">${light}</span></div><div class="h-box"><h4 class="kw-kurstitel"><a href="/kurssuche/kurs/Einbuergerungstest/${id}">Einb&uuml;rgerungstest</a></h4><ul><li>Datum: Fr. ${day}</li><li>Ort: Calw</li></ul><a href="/kurssuche/kurs/Einbuergerungstest/${id}" class="btn">weitere Details</a></div>`;
        const three = `<div class="kw-kursuebersicht">${card("A1", "ausgebucht", "27.11.2026")}${card("A2", "Anmeldung m&ouml;glich", "22.01.2027")}${card("A3", "ausgebucht", "19.02.2027")}</div>`;
        expect(read(three).map(([id, date, , status]) => [id, date, status])).toEqual([
            ["A1", "2026-11-27", "full"],
            ["A2", "2027-01-22", "free"],
            ["A3", "2027-02-19", "full"],
        ]);
    });

    it("reads a card whose first link is a picture and whose button says more than its light", () => {
        const card = (id: string, light: string, tooltip: string, day: string) => `<div class="col"><div class="product-wrap">
            <div class="product-img"><a href="/kurssuche/kurs/Einbuergerungstest/${id}"><img src="/platzhalter.jpg" alt=""></a>
              <div class="ampelstatus"><span class="kw_ampel">${light}</span></div>
              <div class="product-action"><a href="/kurssuche/kurs/Einbuergerungstest/${id}" title="${tooltip}"><i class="pe-7s-info"></i> Kursinfo beachten</a></div></div>
            <div class="product-content"><h3><a href="/kurssuche/kurs/Einbuergerungstest/${id}" title="Mehr Details zum Kurs 'Einb&uuml;rgerungstest' öffnen">Einb&uuml;rgerungstest</a></h3>
              <div><span>Kursbeginn: <strong><abbr title="Mittwoch">Mi.</abbr>, ${day}, 13:00 Uhr</strong></span></div>
              <div><span>Kursort: <strong>vhs, Ahornring 121, Raum 2.2</strong></span></div></div></div></div>`;
        const page = `<div class="row kw-kursuebersicht">${card("262-30121", "Keine Online-Anmeldung m&ouml;glich", "Der Termin ist ausgebucht. Keine Anmeldung mehr möglich.", "2.12.2026")}${card("262-30021", "Anmeldung m&ouml;glich", "Mehr Details aufrufen", "17.2.2027")}</div>`;
        const { courses } = parseKufer(page, PAGE, { today: TODAY });
        // The heading names the course, not the button; the button's tooltip closes the date its light left open.
        expect(courses.map((course) => [course.id, course.title, course.date, course.time, course.status, course.place])).toEqual([
            ["262-30121", "Einbürgerungstest", "2026-12-02", "13:00", "closed", "vhs, Ahornring 121, Raum 2.2"],
            ["262-30021", "Einbürgerungstest", "2027-02-17", "13:00", "free", "vhs, Ahornring 121, Raum 2.2"],
        ]);
    });

    it("keeps a date with its own course when the text stands in front of the link", () => {
        const teaser = (id: string, when: string) => `<div class="teaser"><h3>Einb&uuml;rgerungstest</h3><p>Der Test ist am ${when} in Calw.</p><p><a href="/kurssuche/kurs/Einbuergerungstest/${id}">Zum Kurs</a></p></div>`;
        const page = `<div class="kw-kursuebersicht">${teaser("T1", "Fr. 27.11.2026, 13:00 Uhr")}${teaser("T2", "Fr. 22.01.2027, 9.30 Uhr")}</div>`;
        expect(parseKufer(page, PAGE, { today: TODAY }).courses.map((course) => [course.id, course.date, course.time])).toEqual([
            ["T1", "2026-11-27", "13:00"],
            ["T2", "2027-01-22", "09:30"],
        ]);
    });

    it("reads no light at all where it cannot tell whose it is", () => {
        const row = (id: string, day: string, light: string) => `<p><a href="/kurssuche/kurs/Einbuergerungstest/${id}">Einb&uuml;rgerungstest</a> Fr. ${day}, 13:00 Uhr <span class="kw_ampel">${light}</span></p>`;
        const list = `${row("L1", "27.11.2026", "ausgebucht")}${row("L2", "22.01.2027", "Anmeldung m&ouml;glich")}`;
        const read = (html: string) => parseKufer(html, PAGE, { today: TODAY }).courses.map((course) => [course.id, course.date, course.status]);
        // Link, then light, all the way down: the order is clear.
        expect(read(`<div class="kw-kursuebersicht">${list}</div>`)).toEqual([
            ["L1", "2026-11-27", "full"],
            ["L2", "2027-01-22", "free"],
        ]);
        // A legend in front makes the same list read both ways. The dates stay, nobody is told "free".
        const legend = `<p>Legende: <span class="kw_ampel">Anmeldung m&ouml;glich</span> <span class="kw_ampel">ausgebucht</span></p>`;
        expect(read(`<div class="kw-kursuebersicht">${legend}${list}</div>`)).toEqual([
            ["L1", "2026-11-27", "unknown"],
            ["L2", "2027-01-22", "unknown"],
        ]);
    });

    it("says so when the page is no Kufer page any more", () => {
        expect(parseKufer("<html><body><h1>Wartungsarbeiten</h1></body></html>", PAGE)).toEqual({ recognised: false, courses: [] });
        expect(parseKufer(`<div class="kw-kursuebersicht">Es wurden leider keine passenden Veranstaltungen gefunden.</div>`, PAGE)).toEqual({ recognised: true, courses: [] });
    });
});

const ITEM_OLD = `
<div id="category-courses" data-categoryId="675-CAT-KAT77" class="card-list accordion">
<div class="card-list-item-wrap course-item" data-id="course-card-675-C-2627405KG">
  <a class="card-list-item bg-white" id="course-2627405KG" href="/p/integration/einbuergerungstest/einbuergerungstest-7-26-675-C-2627405KG">
    <div class="card-list-item-icon text-success"><i class="bk-icon bk-type-course bk-inperson bk-av-enough bk-rs-notbookableonline" data-toggle="tooltip" title="Persönliche Anmeldung"></i></div>
    <div class="course-title"> Einbürgerungstest 7-26 <span class="course-subtitle small"></span></div>
    <div class="course-list-item-date"><i class="far fa-calendar"></i> Do. 03.12.2026 14:30</div>
    <div class="course-list-item-location"><i class="far fa-map-marker-alt"></i><span>Bad Kissingen</span></div>
  </a>
  <div class="card-list-item-more collapse" id="card-list-item-more-675-C-2627405KG"><a href="#card-list-item-more-675-C-2627405KG">mehr</a> Anmeldeschluss: drei Wochen vor dem Termin.</div>
</div>
<div class="card-list-item-wrap course-item" data-id="course-card-675-C-2617425KG">
  <a class="card-list-item bg-white" href="/p/integration/einbuergerungstest/einbuergerungstest-5-26-675-C-2617425KG">
    <i class="bk-icon bk-type-course bk-notbookable bk-av-enough bk-rs-coursecompleted"></i>
    <div class="course-title">Einbürgerungstest 5-26</div>
    <div class="course-list-item-date">Do. 17.09.2026 14:30</div>
  </a>
</div>
</div>`;

const ITEM_NEW = `
<div class="course-list d-flex flex-column gap-2 mt-3">
<article class="card collapsed shadow-lg" title="Zu den Details von 'Prüfung: Einbürgerungstest - 33 Fragen'">
  <a href="/kurs/grundbildung/einbuergerungen/einbuergerungstest-33-fragen/pruefung-einbuergerungstest-33-fragen/262-63005" target="_self">
    <div class="col-1" data-bs-toggle="tooltip" title="<em class='bk-text bk-type-course bk-notbookable bk-av-soldout bk-rs-notbookableonline'></em>">
      <i class="bk-icon bk-type-course bk-notbookable bk-av-soldout bk-rs-notbookableonline"></i>
    </div>
    <h3 class="h2 course-title mb-0">
Prüfung: Einbürgerungstest - 33 Fragen</h3>
    <div class="course-subtitle text-muted small"></div>
    <div class="simple-date"> Fr. <span class="start-date text-nowrap" data-date="2026-12-04"> 04.12.2026 </span>
      <span class="text-nowrap"><span class="start-time"> 09:00 </span>&nbsp;Uhr</span></div>
  </a>
</article>
</div>`;

describe("ITEM adapter", () => {
    it("reads the older template: the booking classes on the icon, the place, in-person registration", () => {
        const { recognised, courses } = parseItem(ITEM_OLD, "https://www.vhs-beispiel.de/p/integration/einbuergerungstest-675-CAT-KAT77", { today: TODAY });
        expect(recognised).toBe(true);
        expect(courses.map((course) => [course.id, course.date, course.time, course.status, course.booking])).toEqual([
            ["2627405KG", "2026-12-03", "14:30", "free", "inperson"],
            ["2617425KG", "2026-09-17", "14:30", "closed", null],
        ]);
        expect(courses[0]).toMatchObject({
            title: "Einbürgerungstest 7-26",
            place: "Bad Kissingen",
            url: "https://www.vhs-beispiel.de/p/integration/einbuergerungstest/einbuergerungstest-7-26-675-C-2627405KG",
        });
    });

    it("does not take the deadline in a subtitle for the exam day", () => {
        const page = ITEM_OLD.replace('<span class="course-subtitle small"></span>', '<span class="course-subtitle small">Anmeldeschluss 26.11.2026</span>');
        const { courses } = parseItem(page, "https://www.vhs-beispiel.de/p/integration/einbuergerungstest-675-CAT-KAT77", { today: TODAY });
        expect(courses[0]).toMatchObject({ id: "2627405KG", date: "2026-12-03", time: "14:30", deadline: "2026-11-26", status: "free" });
    });

    it("reads the newer template: the day from data-date, the time from its own element", () => {
        const { courses } = parseItem(ITEM_NEW, "https://www.vhs-beispiel.de/p/grundbildung/einbuergerungen", { today: TODAY });
        expect(courses).toHaveLength(1);
        expect(courses[0]).toMatchObject({ id: "262-63005", title: "Prüfung: Einbürgerungstest - 33 Fragen", date: "2026-12-04", time: "09:00", status: "full" });
    });

    it("says so when the page is no ITEM page any more", () => {
        expect(parseItem("<html><body>404</body></html>", PAGE)).toEqual({ recognised: false, courses: [] });
    });
});

describe("from courses to exam dates", () => {
    it("keeps the test itself and drops courses about it, the integration course's own test and registration appointments", () => {
        for (const title of [
            "Einbürgerungstest",
            "Prüfung: Einbürgerungstest - 33 Fragen",
            "Test Einbürgerung - staatsbürgerliches Wissen",
            "Test „Leben in Deutschland“",
            'Prüfung "Leben in Deutschland" (LiD)',
            "Einbürgerungstest - Anmeldung nur persönlich und vor Ort",
        ]) {
            expect({ title, exam: isExamTitle(title) }).toEqual({ title, exam: true });
        }
        for (const title of [
            "Vorbereitung auf den Einbürgerungstest",
            "Orientierungskurs - Einbürgerungskurs am Vormittag",
            'LID-Test "Leben in Deutschland" (Test zum Orientierungskurs)',
            '144. Integrationskurs Test: "Leben in Deutschland"',
            "Termin Anmeldung zum Einbürgerungstest",
            "Anmeldung: Einbürgerungstest und Zertifikatsprüfung „telc Deutsch A2/B1“",
            "Prüfung: Leben in Deutschland (oK)",
            "Deutsch B1 Prüfung",
        ]) {
            expect({ title, exam: isExamTitle(title) }).toEqual({ title, exam: false });
        }
    });

    it("drops past days, sorts by day and time, and lets a title say full but never free", () => {
        const course = (id: string, date: string, time: string, title: string, status = "unknown") => ({ id, title, date, time, status, url: `https://x.de/${id}`, place: "", booking: null, deadline: null });
        const slots = toSlots(
            [
                course("c", "2027-01-10", "10:00", "Einbürgerungstest - AUSGEBUCHT"),
                course("b", "2027-01-10", "09:00", "Einbürgerungstest - Anmeldung möglich"),
                course("a", "2026-11-21", "09:00", "Einbürgerungstest", "free"),
                course("d", "2026-12-01", "09:00", "Vorbereitung auf den Einbürgerungstest", "free"),
                course("e", "2026-12-02", "09:00", "Einbürgerungstest", "free"),
                course("e", "2026-12-02", "09:00", "Einbürgerungstest", "free"),
            ],
            { today: TODAY },
        );
        expect(slots.map((slot) => `${slot.id}:${slot.status}`)).toEqual(["e:free", "b:unknown", "c:full"]);
        expect(Object.keys(slots[0])).toEqual(["id", "date", "time", "status", "title", "url"]);
        // A dash where the page has no place is no place.
        const placed = (place: string) => toSlots([{ ...course("p", "2027-01-11", "09:00", "Einbürgerungstest"), place }], { today: TODAY })[0].place;
        expect([placed("—"), placed("Rathaus")]).toEqual([undefined, "Rathaus"]);
    });
});

describe("robots.txt", () => {
    const ROBOTS = ["User-agent: *", "Disallow: /intern/", "Disallow: /*.pdf$", "Allow: /intern/kurse", "", "User-agent: LebenInDeutschlandTermine", "Disallow: /kurssuche"].join("\n");

    it("follows the group that names this crawler, and the longest matching rule otherwise", () => {
        expect(isAllowed(ROBOTS, "https://x.de/kurssuche?kathaupt=26")).toBe(false);
        expect(isAllowed(ROBOTS, "https://x.de/intern/geheim")).toBe(true);
        expect(isAllowed(ROBOTS, "https://x.de/intern/geheim", "AndererBot")).toBe(false);
        expect(isAllowed(ROBOTS, "https://x.de/intern/kurse/1", "AndererBot")).toBe(true);
        expect(isAllowed(ROBOTS, "https://x.de/programm/heft.pdf", "AndererBot")).toBe(false);
        expect(isAllowed("", "https://x.de/kurssuche")).toBe(true);
        expect(isAllowed("User-agent: *\nDisallow: /", "https://x.de/kurssuche")).toBe(false);
    });
});

describe("reading the centres' websites", () => {
    it("treats www and the bare domain as one site and anything else as another", () => {
        expect(sameSite("https://www.vhs-x.de/a", "http://vhs-x.de/b")).toBe(true);
        expect(sameSite("https://www.vhs-x.de/a", "https://www.stadt-x.de/vhs")).toBe(false);
    });

    it("decodes a page in the character set it declares", () => {
        const latin1 = Buffer.from("<meta charset=iso-8859-1><p>Einb\xfcrgerungstest</p>", "latin1");
        expect(decodeBody(latin1, "text/html")).toContain("Einbürgerungstest");
        expect(decodeBody(Buffer.from("Einbürgerungstest", "utf8"), "text/html; charset=UTF-8")).toBe("Einbürgerungstest");
    });

    it("follows a redirect within the site and refuses one that leaves it", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://www.vhs-x.de/kurse" } }))
            .mockResolvedValueOnce(new Response("<p>ok</p>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }))
            .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://tracking.example/landing" } }));
        vi.stubGlobal("fetch", fetchMock);
        await expect(getPage("https://vhs-x.de/kurse")).resolves.toEqual({ url: "https://www.vhs-x.de/kurse", html: "<p>ok</p>" });
        await expect(getPage("https://vhs-x.de/kurse")).rejects.toThrow(/another site/);
        expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET" && init.redirect === "manual" && /LebenInDeutschlandTermine/.test(init.headers["user-agent"]))).toBe(true);
    });
});

const SOURCE = { id: "bw-vhs-beispiel", state: "BW", city: "Beispielstadt", name: "VHS Beispielstadt", adapter: "kufer", url: PAGE };

describe("sync", () => {
    it("does not read a page that robots.txt closes, nor one whose rules cannot be read", async () => {
        const page = vi.fn();
        expect(await readSource(SOURCE, { today: TODAY, robots: async () => "User-agent: *\nDisallow: /", page })).toEqual({ ok: false, error: "robots.txt does not allow this page" });
        expect(await readSource(SOURCE, { today: TODAY, robots: async () => null, page })).toEqual({ ok: false, error: "robots.txt could not be read" });
        expect(page).not.toHaveBeenCalled();
    });

    it("turns a page into upcoming exam dates, and a page it no longer recognises into a failed read", async () => {
        const read = (html: string) => readSource(SOURCE, { today: TODAY, robots: async () => "", page: async () => ({ url: PAGE, html }) });
        const good = await read(KUFER_CARDS);
        expect(good.ok ? good.slots.map((slot) => [slot.id, slot.status]) : good.error).toEqual([
            ["YCW44803", "free"],
            ["YCW44804", "unknown"],
        ]);
        expect(await read("<html>Wartung</html>")).toEqual({ ok: false, error: "the page is not a kufer course list any more" });
        expect(await readSource(SOURCE, { today: TODAY, robots: async () => "", page: async () => Promise.reject(new Error("HTTP 503")) })).toEqual({ ok: false, error: "HTTP 503" });
    });

    it("takes a page that suddenly lists no course for a failed read while dates are known for the centre", async () => {
        const empty = `<link href="/fileadmin/kuferweb/layout.css"><h1>Wartungsarbeiten</h1>`;
        const read = (previous: object | null) => readSource(SOURCE, { today: TODAY, robots: async () => "", page: async () => ({ url: PAGE, html: empty }), previous });
        const slot = (date: string) => ({ id: "a", date, status: "free", title: "Einbürgerungstest", url: "https://x.de/a" });
        const known = { ...SOURCE, checkedAt: "2026-11-22T05:17:00.000Z", ok: true, slots: [slot("2026-12-03")] };

        const failed = await read(known);
        expect(failed).toEqual({ ok: false, error: "no course found on the page" });
        // The dates stay, marked as not confirmed, instead of vanishing at once.
        expect(mergeCentre(SOURCE, failed, known, { now: new Date("2026-11-22T09:17:00Z"), today: TODAY })).toMatchObject({ ok: false, slots: [{ date: "2026-12-03" }] });
        // Nothing was expected: an empty list is an empty list. A test held today is over, not expected.
        expect(await read(null)).toEqual({ ok: true, slots: [] });
        expect(await read({ ...known, slots: [slot(TODAY)] })).toEqual({ ok: true, slots: [] });
    });

    it("keeps the dates of the last good read for a few days when a centre stops answering, then drops them", () => {
        const slot = { id: "a", date: "2026-12-03", status: "free", title: "Einbürgerungstest", url: "https://x.de/a" };
        const old = { id: "b", date: "2026-11-20", status: "free", title: "Einbürgerungstest", url: "https://x.de/b" };
        const previous = { ...SOURCE, checkedAt: "2026-11-21T05:17:00.000Z", ok: true, slots: [slot, old] };
        const failed = { ok: false as const, error: "HTTP 503" };

        const soon = mergeCentre(SOURCE, failed, previous, { now: new Date("2026-11-22T09:17:00Z"), today: TODAY });
        expect(soon).toMatchObject({ ok: false, checkedAt: "2026-11-21T05:17:00.000Z", slots: [slot] });

        const late = mergeCentre(SOURCE, failed, previous, { now: new Date("2026-11-26T09:17:00Z"), today: "2026-11-26" });
        expect(STALE_DAYS).toBe(3);
        expect(late).toMatchObject({ ok: false, checkedAt: "2026-11-21T05:17:00.000Z", slots: [] });

        expect(mergeCentre(SOURCE, failed, undefined, { now: new Date("2026-11-22T09:17:00Z"), today: TODAY })).toMatchObject({ ok: false, checkedAt: null, slots: [] });
    });

    it("writes the centres in a stable order and a shape the app accepts", () => {
        const sources = [
            { ...SOURCE, id: "nw-b", state: "NW", city: "Bonn" },
            { ...SOURCE, id: "bw-z", state: "BW", city: "Zell" },
            { ...SOURCE, id: "bw-a", state: "BW", city: "Ädingen", towns: ["Ädingen", "Bdorf"], plz: "70000" },
        ];
        const now = new Date("2026-11-22T09:17:00Z");
        const results = new Map([["bw-a", { ok: true as const, slots: [{ id: "a", date: "2026-12-03", time: "14:30", status: "free", title: "Einbürgerungstest", url: "https://x.de/a" }] }]]);
        const data = buildTermine(sources, results, null, now);
        expect(data.centres.map((centre: { id: string }) => centre.id)).toEqual(["bw-a", "bw-z", "nw-b"]);
        expect(data.centres[0]).toMatchObject({ plz: "70000", towns: ["Ädingen", "Bdorf"], ok: true, checkedAt: now.toISOString() });
        expect(data.centres[1]).toMatchObject({ ok: false, checkedAt: null, slots: [] });
        expect(() => validateTermine(data)).not.toThrow();
    });

    it("rejects a file the app could not show", () => {
        const good = buildTermine([SOURCE], new Map([[SOURCE.id, { ok: true as const, slots: [{ id: "a", date: "2026-12-03", status: "free", title: "Einbürgerungstest", url: "https://x.de/a" }] }]]), null, new Date("2026-11-22T09:17:00Z"));
        const broken = (change: (data: typeof good) => void) => {
            const copy = JSON.parse(JSON.stringify(good));
            change(copy);
            return () => validateTermine(copy);
        };
        expect(broken((data) => (data.centres[0].slots[0].status = "vielleicht"))).toThrow(/unknown status/);
        expect(broken((data) => (data.centres[0].slots[0].url = "javascript:alert(1)"))).toThrow(/url/);
        expect(broken((data) => (data.centres[0].slots[0].date = "03.12.2026"))).toThrow(/date/);
        expect(broken((data) => data.centres.push(data.centres[0]))).toThrow(/twice/);
        expect(broken((data) => (data.version = 2))).toThrow(/version/);
    });

    it("refuses a run in which most centres that answered last time are silent", () => {
        const centre = (id: string, ok: boolean) => ({ id, ok });
        const before = { centres: Array.from({ length: 20 }, (_, index) => centre(`c${index}`, true)) };
        const half = { centres: Array.from({ length: 20 }, (_, index) => centre(`c${index}`, index < 12)) };
        const dark = { centres: Array.from({ length: 20 }, (_, index) => centre(`c${index}`, index < 5)) };
        expect(() => guardTermine(before, half)).not.toThrow();
        expect(() => guardTermine(before, dark)).toThrow(/only 5 sources answered/);
        expect(() => guardTermine(null, dark)).not.toThrow();
    });
});

describe("the registry", () => {
    const sources = JSON.parse(readFileSync(path.resolve(__dirname, "../../termine/sources.json"), "utf8"));

    it("is valid and names every page once", () => {
        expect(() => validateSources(sources)).not.toThrow();
        expect(new Set(sources.map((source: { url: string }) => source.url)).size).toBe(sources.length);
        expect(sources.length).toBeGreaterThan(50);
    });

    it("refuses an entry the sync could not read", () => {
        expect(() => validateSources([{ ...SOURCE, adapter: "magie" }])).toThrow(/unknown adapter/);
        expect(() => validateSources([{ ...SOURCE, url: "ftp://x.de" }])).toThrow(/url/);
        expect(() => validateSources([SOURCE, SOURCE])).toThrow(/twice/);
    });
});

describe("discovery", () => {
    it("groups BAMF's centres by website and names the entry after the first centre of its state", () => {
        const sites = websitesOf([
            { stateCode: "bb", data: [{ ort: "Prenzlau", plz: "17291", einrichtung: "Kreisvolkshochschule Uckermark", email: "info@kvhs-uckermark.de" }, { ort: "Schwedt", plz: "16303", einrichtung: "KVHS Uckermark, Regionalstelle", email: "info@kvhs-uckermark.de" }] },
            { stateCode: "by", data: [{ ort: "Ansbach", plz: "91522", einrichtung: "VHS Ansbach", email: "", website: "www.vhs-ansbach.de" }, { ort: "Hof", plz: "95028", einrichtung: "Privatschule", email: "<mailbox>@t-online.de" }] },
        ]);
        expect(sites.map((site: { domain: string }) => site.domain)).toEqual(["kvhs-uckermark.de", "vhs-ansbach.de"]);
        expect(describeSite(sites[0])).toEqual({ id: "bb-kvhs-uckermark", state: "BB", city: "Prenzlau", name: "Kreisvolkshochschule Uckermark", plz: "17291", towns: ["Prenzlau", "Schwedt"] });
    });

    it("builds the keyword search a Kufer site's own form would send, hidden fields included", () => {
        const home = `<form action="/kw/bereich/suche/suchesetzen/true/" method="get"><input type="hidden" name="kathaupt" value="26;"><input type="hidden" name="suchesetzen" value="false;"><input name="kfs_stichwort_schlagwort" type="text"></form>
            <a href="/kurssuche/kurs/Yoga/A1">Yoga</a><a href="https://anderswo.example/kurs/x/1">fremd</a>`;
        expect(kuferSearchUrls(home, "https://www.vhs-x.de/")).toEqual([
            "https://www.vhs-x.de/kw/bereich/suche/suchesetzen/true/?kathaupt=26%3B&suchesetzen=false%3B&kfs_stichwort_schlagwort=Einb%C3%BCrgerungstest",
            "https://www.vhs-x.de/kurssuche?kathaupt=26&suchesetzen=false&kfs_stichwort_schlagwort=Einb%C3%BCrgerungstest",
        ]);
    });

    it("follows links about the test on the same site, the test itself first", () => {
        const home = `<a href="/integration">Integration und Einbürgerung</a><a href="/pruefungen/einbuergerungstest">Einbürgerungstest: Termine</a>
            <a href="https://bamf.example/einbuergerungstest">BAMF</a><a href="/files/einbuergerungstest.pdf">Merkblatt</a><a href="/yoga">Yoga</a>`;
        expect(examLinks(home, "https://www.vhs-x.de/")).toEqual(["https://www.vhs-x.de/pruefungen/einbuergerungstest", "https://www.vhs-x.de/integration"]);
    });

    it("adds new candidates to the registry and leaves the entries that are there", () => {
        const kept = { ...SOURCE, url: "https://hand-gepflegt.example/termine" };
        const merged = mergeSources([kept], [{ ...SOURCE, url: PAGE, exams: 3 }, { id: "by-neu", state: "BY", city: "Aach", name: "VHS Aach", adapter: "item", url: "https://vhs-aach.example/p", exams: 2, sample: [] }, { id: "by-leer", state: "BY", city: "Leer", name: "Ohne Seite", note: "no adapter" }]);
        expect(merged).toEqual([kept, { id: "by-neu", state: "BY", city: "Aach", name: "VHS Aach", adapter: "item", url: "https://vhs-aach.example/p" }]);
    });
});
