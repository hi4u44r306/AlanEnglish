const BASIC_READING_CODE_PATTERN = /^BasicReading_(400|800|1200)_([123])$/i;

export const BASIC_READING_LEVELS = Object.freeze([400, 800, 1200]);

export const getBasicReadingBookMeta = book => {
    const match = String(book?.code || "").match(BASIC_READING_CODE_PATTERN);
    if (!match) return null;
    return {
        level: Number(match[1]),
        bookNumber: Number(match[2])
    };
};

export const isBasicReadingBook = book => Boolean(getBasicReadingBookMeta(book));

export const sortBasicReadingBooks = books => [...books].sort((first, second) => {
    const firstMeta = getBasicReadingBookMeta(first);
    const secondMeta = getBasicReadingBookMeta(second);
    if (!firstMeta || !secondMeta) return 0;
    return firstMeta.level - secondMeta.level || firstMeta.bookNumber - secondMeta.bookNumber;
});

export const createBasicReadingCategory = books => ({
    id: "basic-reading",
    code: "basic-reading",
    name: "Basic Reading",
    navigationType: "basic-reading",
    books: sortBasicReadingBooks(books)
});
