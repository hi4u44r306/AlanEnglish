export const toStripeTwdMinorUnits = (value: unknown) => {
    if (value === null || value === "" || typeof value === "boolean") return null;

    const majorUnits = Number(value);
    if (!Number.isFinite(majorUnits) || majorUnits < 0) return null;

    const exactMinorUnits = majorUnits * 100;
    const minorUnits = Math.round(exactMinorUnits);
    if (!Number.isSafeInteger(minorUnits) || Math.abs(exactMinorUnits - minorUnits) > 1e-9) return null;

    return minorUnits;
};
