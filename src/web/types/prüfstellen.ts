export interface PrüfstellenData {
    stateCode: string;
    data: Prüfstellen[];
}

export interface Prüfstellen {
    regierungsbezirk: string;
    plz: string;
    ort: string;
    einrichtung: string;
    straße: string;
    telefon: string;
    email: string;
    /** Set when BAMF's "E-Mail" column held a web address; `email` is then empty. */
    website?: string;
}