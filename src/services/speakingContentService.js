import { callEdgeFunction } from "./edgeFunctionClient";

const callSpeakingContent = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("speaking-content-manager", firebaseUser, { action, ...payload })
);

export const getSpeakingContentBootstrap = firebaseUser => callSpeakingContent(firebaseUser, "bootstrap");
export const prepareSpeakingSourceUpload = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "create_document_upload", payload);
export const extractSpeakingSourceDocument = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "extract_document", payload);
export const reviewSpeakingOcrSource = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "review_ocr_source", payload);
export const saveReviewedSpeakingSource = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "save_reviewed_source", payload);
export const generateSpeakingQuestionSet = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "generate_question_set", payload);
export const updateDraftSpeakingQuestion = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "update_draft_question", payload);
export const publishSpeakingQuestionSet = (firebaseUser, questionSetId) => callSpeakingContent(firebaseUser, "publish_question_set", { question_set_id: questionSetId });

export const uploadAndExtractSpeakingSource = async (firebaseUser, file, metadata) => {
    const prepared = await prepareSpeakingSourceUpload(firebaseUser, {
        book_id: metadata.book_id,
        document_title: metadata.document_title,
        original_filename: file.name,
        mime_type: file.type,
        byte_size: file.size
    });
    const uploadResponse = await fetch(prepared.upload.url, {
        method: prepared.upload.method || "PUT",
        headers: prepared.upload.headers || { "Content-Type": file.type },
        body: file
    });
    if (!uploadResponse.ok) {
        await callSpeakingContent(firebaseUser, "discard_document_upload", { document_id: prepared.document_id }).catch(() => null);
        throw new Error(`私人教材上傳失敗（HTTP ${uploadResponse.status}）`);
    }
    try {
        return await extractSpeakingSourceDocument(firebaseUser, { ...metadata, document_id: prepared.document_id });
    } catch (error) {
        error.documentId = prepared.document_id;
        throw error;
    }
};
