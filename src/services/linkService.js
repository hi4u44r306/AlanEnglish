import { supabase } from "../components/Pages/supabase-config";
import { callEdgeFunction } from "./edgeFunctionClient";
import { sortLinkItemsAscending } from "../utils/linkSort";

export const LINK_CATEGORIES = [
    { value: "special", label: "Special" },
    { value: "exercise", label: "習作本" },
    { value: "listening", label: "聽力本" },
    { value: "discovery", label: "Discovery" },
    { value: "speedphonics", label: "Speed Phonics" }
];

export const getPublicLinks = async () => {
    const { data, error } = await supabase
        .from("links")
        .select("id,title,url,category,sort_order")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("title", { ascending: true })
        .order("sort_order", { ascending: true });

    if (error) throw error;
    return sortLinkItemsAscending(data || []);
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
