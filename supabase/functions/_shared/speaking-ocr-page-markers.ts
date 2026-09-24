export const wholeBookOcrPageMarkersMatch = (sourceText: unknown, pageFrom: number, pageTo: number) => {
    if (!Number.isInteger(pageFrom) || !Number.isInteger(pageTo) || pageFrom < 1 || pageTo < pageFrom) return false;
    const markers = [...String(sourceText || "").matchAll(/^\s*\[\[PAGE\s+P([1-9][0-9]{0,3})\]\]\s*$/gim)]
        .map(match => Number(match[1]));
    if (markers.length !== pageTo - pageFrom + 1) return false;
    return markers.every((page, index) => page === pageFrom + index);
};
