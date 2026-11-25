// The course systems the sync can read. A source in sources.json names one.
import { isCmxPage, parseCmx } from "./cmx.mjs";
import { isItemPage, parseItem } from "./item.mjs";
import { isKuferPage, parseKufer } from "./kufer.mjs";

export const ADAPTERS = {
    kufer: { parse: parseKufer, recognises: isKuferPage },
    item: { parse: parseItem, recognises: isItemPage },
    cmx: { parse: parseCmx, recognises: isCmxPage },
};

export const ADAPTER_NAMES = Object.keys(ADAPTERS);
