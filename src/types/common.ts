export type Languages = {
    [key: string]: string;
};

export type ApiTypes = {
    [key: string]: string;
};

export interface ValidationOptions {
    checkFormat?: boolean;
    checkAuthor?: boolean;
    checkVersion?: boolean;
    checkTranslations?: boolean;
}

export interface SubmitMark {
    id: string;
    name: string;
    type: number;
    number: string;
}

export interface NameTranslationJSON {
    [key: string]: string;
}
