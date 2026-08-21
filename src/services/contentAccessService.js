import { callEdgeFunction } from "./edgeFunctionClient";

export const getAccessibleCatalog = firebaseUser => (
    callEdgeFunction("content-access", firebaseUser, { action: "catalog" })
);

export const getAccessibleBook = (firebaseUser, bookCode) => (
    callEdgeFunction("content-access", firebaseUser, { action: "book", book_code: bookCode })
);
