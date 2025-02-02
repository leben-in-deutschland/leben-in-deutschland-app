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
}