import { supabase } from "../components/Pages/supabase-config";
import { callEdgeFunction } from "./edgeFunctionClient";

export const LINK_CATEGORIES = [
    { value: "special", label: "Special" },
    { value: "exercise", label: "習作本" },
    { value: "listening", label: "聽力本" },
    { value: "discovery", label: "Discovery" },
    { value: "speedphonics", label: "Speed Phonics" }
];

const sortLinks = items => [...(items || [])].sort((a, b) => {
    const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""));
    if (categoryCompare !== 0) return categoryCompare;
    const orderCompare = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    if (orderCompare !== 0) return orderCompare;
    return String(a.title || "").localeCompare(String(b.title || ""), "zh-Hant", {
        numeric: true,
        sensitivity: "base"
    });
});

export const getPublicLinks = async () => {
    const { data, error } = await supabase
        .from("links")
        .select("id,title,url,category,sort_order")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

    if (error) throw error;
    return sortLinks(data || []);
};

const callLinkManager = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("link-manager", firebaseUser, { action, ...payload })
);

export const bootstrapManagedLinks = firebaseUser => callLinkManager(firebaseUser, "bootstrap");
export const getManagedLinks = firebaseUser => callLinkManager(firebaseUser, "list");
export const importFirebaseLinks = firebaseUser => callLinkManager(firebaseUser, "import_firebase");
export const createManagedLink = (firebaseUser, payload) => callLinkManager(firebaseUser, "create", payload);
export const updateManagedLink = (firebaseUser, payload) => callLinkManager(firebaseUser, "update", payload);
export const deleteManagedLink = (firebaseUser, id) => callLinkManager(firebaseUser, "delete", { id });
