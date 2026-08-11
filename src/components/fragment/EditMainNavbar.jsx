import React, { useEffect, useMemo, useState } from "react";
import "../assets/scss/EditMainNavbar.scss";
import { supabase } from "../Pages/supabase-config";

function EditMainNavbar() {

    const [categories, setCategories] = useState([]);
    const [books, setBooks] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [searchText, setSearchText] = useState("");

    const [newCategory, setNewCategory] = useState({
        name: "",
        code: ""
    });

    const [newBook, setNewBook] = useState({
        category_id: "",
        name: "",
        code: ""
    });


    // =====================================================
    // 讀取教材分類 + 教材
    // =====================================================

    const fetchData = async () => {

        try {

            setLoading(true);


            // =============================
            // Categories
            // =============================

            const {
                data: categoryData,
                error: categoryError
            } = await supabase
                .from("book_categories")
                .select("*")
                .order("sort_order", {
                    ascending: true
                });


            if (categoryError) {

                console.error(
                    "讀取分類失敗:",
                    categoryError
                );

                alert("讀取教材分類失敗");

                return;
            }


            // =============================
            // Books
            // =============================

            const {
                data: bookData,
                error: bookError
            } = await supabase
                .from("books")
                .select("*")
                .order("category_id", {
                    ascending: true
                })
                .order("sort_order", {
                    ascending: true
                });


            if (bookError) {

                console.error(
                    "讀取教材失敗:",
                    bookError
                );

                alert("讀取教材失敗");

                return;
            }


            setCategories(
                categoryData || []
            );

            setBooks(
                bookData || []
            );


        } catch (error) {

            console.error(
                "教材管理讀取錯誤:",
                error
            );

        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {

        fetchData();

    }, []);


    // =====================================================
    // Dashboard 統計
    // =====================================================

    const dashboardStats = useMemo(() => {

        return {

            categoryCount:
                categories.length,

            bookCount:
                books.length,

            enabledBookCount:
                books.filter(
                    book => book.enabled
                ).length

        };

    }, [categories, books]);


    // =====================================================
    // 搜尋教材
    // =====================================================

    const matchesSearch = (book) => {

        const keyword =
            searchText
                .trim()
                .toLowerCase();


        if (!keyword) {
            return true;
        }


        return (

            book.name
                ?.toLowerCase()
                .includes(keyword)

            ||

            book.code
                ?.toLowerCase()
                .includes(keyword)

        );

    };


    // =====================================================
    // 自動產生 Code
    // =====================================================

    const createCodeFromName = (name) => {

        return name
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[^\w-]/g, "");

    };


    // =====================================================
    // 新增教材分類
    // =====================================================

    const handleAddCategory = async () => {

        const name =
            newCategory.name.trim();

        const code =
            newCategory.code.trim();


        if (!name) {

            alert("請輸入分類名稱");

            return;
        }


        if (!code) {

            alert("請輸入分類 Code");

            return;
        }


        try {

            setSaving(true);


            const nextSortOrder =
                categories.length > 0
                    ? Math.max(
                        ...categories.map(
                            item =>
                                Number(
                                    item.sort_order
                                ) || 0
                        )
                    ) + 1
                    : 1;


            const {
                error
            } = await supabase
                .from("book_categories")
                .insert({

                    name,

                    code,

                    sort_order:
                        nextSortOrder,

                    enabled:
                        true

                });


            if (error) {

                console.error(
                    "新增分類失敗:",
                    error
                );

                alert(
                    `新增分類失敗：${error.message}`
                );

                return;
            }


            setNewCategory({
                name: "",
                code: ""
            });


            await fetchData();


        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // 新增教材
    // =====================================================

    const handleAddBook = async () => {

        const categoryId =
            Number(
                newBook.category_id
            );

        const name =
            newBook.name.trim();

        const code =
            newBook.code.trim();


        if (
            !categoryId ||
            !name ||
            !code
        ) {

            alert(
                "請完整填寫分類、教材名稱與 Code"
            );

            return;
        }


        try {

            setSaving(true);


            const sameCategoryBooks =
                books.filter(
                    book =>
                        Number(
                            book.category_id
                        )
                        === categoryId
                );


            const nextSortOrder =
                sameCategoryBooks.length > 0
                    ? Math.max(
                        ...sameCategoryBooks.map(
                            item =>
                                Number(
                                    item.sort_order
                                ) || 0
                        )
                    ) + 1
                    : 1;


            const {
                error
            } = await supabase
                .from("books")
                .insert({

                    category_id:
                        categoryId,

                    name,

                    code,

                    sort_order:
                        nextSortOrder,

                    enabled:
                        true

                });


            if (error) {

                console.error(
                    "新增教材失敗:",
                    error
                );

                alert(
                    `新增教材失敗：${error.message}`
                );

                return;
            }


            setNewBook({

                category_id:
                    "",

                name:
                    "",

                code:
                    ""

            });


            await fetchData();


        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // 顯示 / 隱藏教材
    // =====================================================

    const handleToggleBook = async (book) => {

        try {

            setSaving(true);


            const {
                error
            } = await supabase
                .from("books")
                .update({

                    enabled:
                        !book.enabled,

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    book.id
                );


            if (error) {

                console.error(
                    "修改教材狀態失敗:",
                    error
                );

                alert(
                    `修改失敗：${error.message}`
                );

                return;
            }


            await fetchData();


        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // 修改教材名稱
    // =====================================================

    const handleRenameBook = async (book) => {

        const newName =
            window.prompt(
                "請輸入新的教材名稱",
                book.name
            );


        if (!newName) {
            return;
        }


        const trimmedName =
            newName.trim();


        if (
            !trimmedName ||
            trimmedName === book.name
        ) {
            return;
        }


        try {

            setSaving(true);


            const {
                error
            } = await supabase
                .from("books")
                .update({

                    name:
                        trimmedName,

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    book.id
                );


            if (error) {

                console.error(
                    "修改教材名稱失敗:",
                    error
                );

                alert(
                    `修改名稱失敗：${error.message}`
                );

                return;
            }


            await fetchData();


        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // 修改教材 Code
    // =====================================================

    const handleRenameCode = async (book) => {

        const newCode =
            window.prompt(
                "請輸入新的教材 Code",
                book.code
            );


        if (!newCode) {
            return;
        }


        const trimmedCode =
            newCode.trim();


        if (
            !trimmedCode ||
            trimmedCode === book.code
        ) {
            return;
        }


        const confirmChange =
            window.confirm(
                `確定要把 Code 從\n\n${book.code}\n\n修改成\n\n${trimmedCode}\n\n嗎？\n\n注意：網址也會跟著改變。`
            );


        if (!confirmChange) {
            return;
        }


        try {

            setSaving(true);


            const {
                error
            } = await supabase
                .from("books")
                .update({

                    code:
                        trimmedCode,

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    book.id
                );


            if (error) {

                console.error(
                    "修改教材 Code 失敗:",
                    error
                );

                alert(
                    `修改 Code 失敗：${error.message}`
                );

                return;
            }


            await fetchData();


        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // 刪除教材
    // =====================================================

    const handleDeleteBook = async (book) => {

        const confirmDelete =
            window.confirm(
                `確定要刪除「${book.name}」嗎？\n\n⚠️ 這個動作可能會連同相關 music_tracks 資料一起刪除。\n\n建議如果只是暫時不使用，請改用「隱藏教材」。`
            );


        if (!confirmDelete) {
            return;
        }


        const secondConfirm =
            window.confirm(
                `再次確認：真的要永久刪除「${book.name}」嗎？`
            );


        if (!secondConfirm) {
            return;
        }


        try {

            setSaving(true);


            const {
                error
            } = await supabase
                .from("books")
                .delete()
                .eq(
                    "id",
                    book.id
                );


            if (error) {

                console.error(
                    "刪除教材失敗:",
                    error
                );

                alert(
                    `刪除教材失敗：${error.message}`
                );

                return;
            }


            await fetchData();


        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // 刪除分類
    // =====================================================

    const handleDeleteCategory = async (
        category
    ) => {

        const categoryBooks =
            books.filter(
                book =>
                    Number(
                        book.category_id
                    )
                    === Number(
                        category.id
                    )
            );


        if (
            categoryBooks.length > 0
        ) {

            alert(
                `「${category.name}」底下還有 ${categoryBooks.length} 本教材。\n\n請先移除或刪除該分類下的教材。`
            );

            return;
        }


        const confirmDelete =
            window.confirm(
                `確定要刪除分類「${category.name}」嗎？`
            );


        if (!confirmDelete) {
            return;
        }


        try {

            setSaving(true);


            const {
                error
            } = await supabase
                .from("book_categories")
                .delete()
                .eq(
                    "id",
                    category.id
                );


            if (error) {

                console.error(
                    "刪除分類失敗:",
                    error
                );

                alert(
                    `刪除分類失敗：${error.message}`
                );

                return;
            }


            await fetchData();


        } finally {

            setSaving(false);

        }

    };


    // =====================================================
    // Loading
    // =====================================================

    if (loading) {

        return (

            <div className="edit-navbar-container">

                <h2>
                    教材管理
                </h2>

                <p className="page-subtitle">
                    正在讀取教材資料...
                </p>

            </div>

        );

    }


    // =====================================================
    // Render
    // =====================================================

    return (

        <div className="edit-navbar-container">


            {/* ================================= */}
            {/* Header */}
            {/* ================================= */}

            <h2>
                教材管理
            </h2>

            <p className="page-subtitle">
                管理 Alan English 的教材分類、Navbar 顯示內容與教材狀態
            </p>


            {/* ================================= */}
            {/* Dashboard */}
            {/* ================================= */}

            <div className="library-dashboard">

                <div className="dashboard-card">

                    <div className="dashboard-label">
                        教材分類
                    </div>

                    <div className="dashboard-value">
                        {
                            dashboardStats.categoryCount
                        }
                    </div>

                </div>


                <div className="dashboard-card">

                    <div className="dashboard-label">
                        教材總數
                    </div>

                    <div className="dashboard-value">
                        {
                            dashboardStats.bookCount
                        }
                    </div>

                </div>


                <div className="dashboard-card">

                    <div className="dashboard-label">
                        顯示中的教材
                    </div>

                    <div className="dashboard-value">
                        {
                            dashboardStats.enabledBookCount
                        }
                    </div>

                </div>

            </div>


            {/* ================================= */}
            {/* 新增分類 */}
            {/* ================================= */}

            <div className="add-dropdown-section">

                <h3>
                    新增教材分類
                </h3>


                <input

                    type="text"

                    placeholder="分類名稱，例如：會話教材"

                    value={
                        newCategory.name
                    }

                    onChange={(e) => {

                        const name =
                            e.target.value;


                        setNewCategory({

                            ...newCategory,

                            name,

                            code:
                                newCategory.code
                                ||
                                createCodeFromName(
                                    name
                                )

                        });

                    }}

                />


                <input

                    type="text"

                    placeholder="Code，例如 conversation"

                    value={
                        newCategory.code
                    }

                    onChange={(e) =>

                        setNewCategory({

                            ...newCategory,

                            code:
                                e.target.value

                        })

                    }

                />


                <button

                    onClick={
                        handleAddCategory
                    }

                    disabled={
                        saving
                    }

                >

                    {
                        saving
                            ? "處理中..."
                            : "新增分類"
                    }

                </button>

            </div>


            {/* ================================= */}
            {/* 新增教材 */}
            {/* ================================= */}

            <div className="add-item-section-container">

                <h3>
                    新增教材
                </h3>


                <div className="add-item-section">

                    <select

                        value={
                            newBook.category_id
                        }

                        onChange={(e) =>

                            setNewBook({

                                ...newBook,

                                category_id:
                                    e.target.value

                            })

                        }

                    >

                        <option value="">
                            選擇分類
                        </option>


                        {
                            categories.map(
                                category => (

                                    <option

                                        key={
                                            category.id
                                        }

                                        value={
                                            category.id
                                        }

                                    >

                                        {
                                            category.name
                                        }

                                    </option>

                                )
                            )
                        }

                    </select>


                    <input

                        type="text"

                        placeholder="教材名稱，例如 Workbook 7"

                        value={
                            newBook.name
                        }

                        onChange={(e) => {

                            const name =
                                e.target.value;


                            setNewBook({

                                ...newBook,

                                name,

                                code:
                                    createCodeFromName(
                                        name
                                    )

                            });

                        }}

                    />


                    <input

                        type="text"

                        placeholder="Code，例如 Workbook_7"

                        value={
                            newBook.code
                        }

                        onChange={(e) =>

                            setNewBook({

                                ...newBook,

                                code:
                                    e.target.value

                            })

                        }

                    />

                </div>


                <button

                    onClick={
                        handleAddBook
                    }

                    disabled={
                        saving
                    }

                >

                    {
                        saving
                            ? "處理中..."
                            : "新增教材"
                    }

                </button>

            </div>


            {/* ================================= */}
            {/* 搜尋 */}
            {/* ================================= */}

            <div className="book-toolbar">

                <input

                    className="search-box"

                    type="text"

                    placeholder="搜尋教材名稱或 Code..."

                    value={
                        searchText
                    }

                    onChange={(e) =>
                        setSearchText(
                            e.target.value
                        )
                    }

                />


                <div className="toolbar-info">

                    共 {books.length} 本教材

                </div>

            </div>


            {/* ================================= */}
            {/* 教材分類列表 */}
            {/* ================================= */}

            {
                categories.map(
                    category => {

                        const allCategoryBooks =
                            books.filter(
                                book =>
                                    Number(
                                        book.category_id
                                    )
                                    === Number(
                                        category.id
                                    )
                            );


                        const categoryBooks =
                            allCategoryBooks.filter(
                                matchesSearch
                            );


                        return (

                            <div

                                key={
                                    category.id
                                }

                                className="category-wrapper"

                            >

                                <div className="nav-item-container">


                                    {/* Category Header */}

                                    <h3>

                                        <span>

                                            {
                                                category.name
                                            }

                                            <span className="category-count">

                                                {
                                                    allCategoryBooks.length
                                                }

                                            </span>

                                        </span>


                                        <button

                                            className="delete-dropdown"

                                            onClick={() =>
                                                handleDeleteCategory(
                                                    category
                                                )
                                            }

                                            disabled={
                                                saving
                                            }

                                        >

                                            刪除分類

                                        </button>

                                    </h3>


                                    <div className="category-code">

                                        Code：

                                        <strong>
                                            {
                                                category.code
                                            }
                                        </strong>

                                    </div>


                                    {/* Empty */}

                                    {
                                        categoryBooks.length === 0
                                            ?

                                            <div className="empty-state">

                                                {
                                                    searchText
                                                        ? "這個分類沒有符合搜尋條件的教材"
                                                        : "這個分類目前還沒有教材"
                                                }

                                            </div>

                                            :

                                            <ul>

                                                {
                                                    categoryBooks.map(
                                                        book => (

                                                            <li
                                                                key={
                                                                    book.id
                                                                }
                                                            >


                                                                {/* 左側教材資訊 */}

                                                                <div className="book-main">

                                                                    <div className="book-title">

                                                                        {
                                                                            book.name
                                                                        }

                                                                    </div>


                                                                    <div className="book-code">

                                                                        {
                                                                            book.code
                                                                        }

                                                                    </div>


                                                                    <span

                                                                        className={
                                                                            `status-badge ${book.enabled
                                                                                ? "status-enabled"
                                                                                : "status-disabled"
                                                                            }`
                                                                        }

                                                                    >

                                                                        {
                                                                            book.enabled
                                                                                ? "顯示中"
                                                                                : "已隱藏"
                                                                        }

                                                                    </span>

                                                                </div>


                                                                {/* 操作 */}

                                                                <div className="book-actions">

                                                                    <button

                                                                        onClick={() =>
                                                                            handleRenameBook(
                                                                                book
                                                                            )
                                                                        }

                                                                        disabled={
                                                                            saving
                                                                        }

                                                                    >

                                                                        修改名稱

                                                                    </button>


                                                                    <button

                                                                        onClick={() =>
                                                                            handleRenameCode(
                                                                                book
                                                                            )
                                                                        }

                                                                        disabled={
                                                                            saving
                                                                        }

                                                                    >

                                                                        修改 Code

                                                                    </button>


                                                                    <button

                                                                        onClick={() =>
                                                                            handleToggleBook(
                                                                                book
                                                                            )
                                                                        }

                                                                        disabled={
                                                                            saving
                                                                        }

                                                                    >

                                                                        {
                                                                            book.enabled
                                                                                ? "隱藏教材"
                                                                                : "顯示教材"
                                                                        }

                                                                    </button>


                                                                    <button

                                                                        className="danger-button"

                                                                        onClick={() =>
                                                                            handleDeleteBook(
                                                                                book
                                                                            )
                                                                        }

                                                                        disabled={
                                                                            saving
                                                                        }

                                                                    >

                                                                        刪除

                                                                    </button>

                                                                </div>

                                                            </li>

                                                        )
                                                    )
                                                }

                                            </ul>
                                    }

                                </div>

                            </div>

                        );

                    }
                )
            }

        </div>

    );

}


export default EditMainNavbar;