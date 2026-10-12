import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import useStudentPageQuery from "../../hooks/useStudentPageQuery";
import { getAccessibleCatalog } from "../../services/contentAccessService";
import { getStudentMaterialCategories } from "../../utils/studentLearning";

// 教材 as a page of its own: one big card per book, showing only the name. The catalog is the
// same one the rest of the student shell uses, so the server still decides what is listed.
export default function StudentMaterials() {
    const { firebaseUser } = useAuth();
    const catalogQuery = useStudentPageQuery("catalog", () => getAccessibleCatalog(firebaseUser), { enabled: Boolean(firebaseUser) });
    const books = getStudentMaterialCategories(catalogQuery.data?.categories).flatMap(category => category.books).filter(book => book.locked !== true);

    return <main className="student-materials-page">
        <h1>教材</h1>
        {catalogQuery.loading ? <p className="ae-student-menu-status" role="status">教材載入中...</p>
            : catalogQuery.error && !catalogQuery.data ? <p className="ae-student-menu-status error" role="status">教材暫時無法載入<button type="button" onClick={() => catalogQuery.refresh()}>重新讀取</button></p>
            : !books.length ? <p className="ae-student-menu-status" role="status">目前沒有可使用的教材</p>
            : <div className="ae-student-material-grid">
                {books.map(book => <Link key={book.id || book.code} to={book.path || `/student/books/${encodeURIComponent(book.code)}`}>{book.name}</Link>)}
            </div>}
    </main>;
}
