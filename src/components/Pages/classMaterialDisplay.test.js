import { currentClassMaterialNames, currentClassMaterialSetting } from "./classMaterialDisplay";

test("current display ignores future, inactive, expired and other-class settings", () => {
    const current = { id: 1, class_id: 3, is_active: true, version: 1, effective_from: "2026-01-01", effective_to: null };
    const rows = [current, { ...current, id: 2, version: 2, effective_from: "2026-11-01" },
        { ...current, id: 3, version: 3, is_active: false }, { ...current, id: 4, version: 4, effective_to: "2026-09-30" },
        { ...current, id: 5, version: 5, class_id: 7 }];
    expect(currentClassMaterialSetting(rows, 3, "2026-10-08")).toBe(current);
    expect(currentClassMaterialSetting(rows, 1, "2026-10-08")).toBeNull();
});
test("selects the highest active version including the end date without mutating source order", () => {
    const row = { class_id: 1, is_active: true, effective_from: "2026-10-01", effective_to: "2026-10-08" };
    const rows = [{ ...row, version: 1 }, { ...row, version: 2 }];
    expect(currentClassMaterialSetting(rows, 1, "2026-10-08").version).toBe(2);
    expect(rows[0].version).toBe(1);
    expect(currentClassMaterialSetting(rows, 1, "2026-10-09")).toBeNull();
});
test("uses joined names even if a book is missing from the picker, and preserves selection order", () => {
    const setting = { academy_class_material_books: [{ book_id: 1, books: [{ name: "Workbook 1" }] }, { book_id: 2 }, { book_id: 3 }] };
    expect(currentClassMaterialNames(setting, [{ id: 2, name: "Reading 1" }])).toBe("Workbook 1、Reading 1、教材 #3");
    expect(currentClassMaterialNames(null, [])).toBe("尚未設定生效教材");
});
