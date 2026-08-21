import { callEdgeFunction } from "./edgeFunctionClient";

const callCatalogAdmin = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("catalog-admin", firebaseUser, { action, ...payload })
);

export const getCatalogAdminBootstrap = firebaseUser => callCatalogAdmin(firebaseUser, "bootstrap");
export const addBookCategory = (firebaseUser, payload) => callCatalogAdmin(firebaseUser, "add_category", payload);
export const addCatalogBook = (firebaseUser, payload) => callCatalogAdmin(firebaseUser, "add_book", payload);
export const updateCatalogBook = (firebaseUser, payload) => callCatalogAdmin(firebaseUser, "update_book", payload);
export const deleteCatalogBook = (firebaseUser, bookId) => callCatalogAdmin(firebaseUser, "delete_book", { book_id: bookId });
export const deleteBookCategory = (firebaseUser, categoryId) => callCatalogAdmin(firebaseUser, "delete_category", { category_id: categoryId });
