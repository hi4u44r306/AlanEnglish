// Match commerce-manager's currentClassSetting display rule; does not grant access.
export const currentClassMaterialSetting = (settings, classId, date) => (settings || [])
    .filter(setting => Number(setting.class_id) === Number(classId)
        && setting.is_active === true && setting.effective_from <= date
        && (!setting.effective_to || setting.effective_to >= date))
    .sort((a, b) => Number(b.version) - Number(a.version))[0] || null;

export const currentClassMaterialNames = (setting, books) => (setting?.academy_class_material_books || [])
    .map(row => {
        const linked = Array.isArray(row.books) ? row.books[0] : row.books;
        return linked?.name || (books || []).find(book => Number(book.id) === Number(row.book_id))?.name || `教材 #${row.book_id}`;
    }).join("、") || "尚未設定生效教材";
