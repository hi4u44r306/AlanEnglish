import { callEdgeFunction } from "./edgeFunctionClient";
import { splitWholeBookPdf } from "./pdfBookSplitter";

const callSpeakingContent = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("speaking-content-manager", firebaseUser, { action, ...payload })
);

export const getSpeakingContentBootstrap = firebaseUser => callSpeakingContent(firebaseUser, "bootstrap");
export const prepareSpeakingSourceUpload = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "create_document_upload", payload);
export const extractSpeakingSourceDocument = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "extract_document", payload);
export const reviewSpeakingOcrSource = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "review_ocr_source", payload);
export const saveReviewedSpeakingSource = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "save_reviewed_source", payload);
export const generateSpeakingQuestionSet = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "generate_question_set", payload);
export const createWorkbookOneStarterQuestionSet = (firebaseUser, bookId) => callSpeakingContent(firebaseUser, "create_workbook_1_starter", { book_id: bookId });
export const updateDraftSpeakingQuestion = (firebaseUser, payload) => callSpeakingContent(firebaseUser, "update_draft_question", payload);
export const publishSpeakingQuestionSet = (firebaseUser, questionSetId) => callSpeakingContent(firebaseUser, "publish_question_set", { question_set_id: questionSetId });
export const generateSpeakingQuestionSetAudio = (firebaseUser, questionSetId) => (
    callEdgeFunction("speaking-tts-manager", firebaseUser, { action: "generate_set_audio", question_set_id: questionSetId })
);
export const extractSpeakingBookChunk = (firebaseUser, chunkId) => callSpeakingContent(firebaseUser, "extract_book_chunk", { chunk_id: chunkId });
export const discardSpeakingSourceUpload = (firebaseUser, documentId) => callSpeakingContent(firebaseUser, "discard_document_upload", { document_id: documentId });

const uploadPrivatePdf = async (upload, body) => {
    let response;
    try {
        response = await fetch(upload.url, {
            method: upload.method || "PUT",
            headers: upload.headers || { "Content-Type": "application/pdf" },
            body
        });
    } catch (error) {
        throw new Error("無法連線到私人教材儲存空間。請確認 R2 CORS 已允許目前網站與 PUT 上傳後再重試。", { cause: error });
    }
    if (!response.ok) throw new Error(`私人教材上傳失敗（HTTP ${response.status}）`);
};

const runUploadPool = async (items, concurrency, worker) => {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
            const current = cursor;
            cursor += 1;
            await worker(items[current]);
        }
    });
    await Promise.all(runners);
};

export const uploadWholeBookSource = async (firebaseUser, file, metadata, onProgress = () => {}) => {
    onProgress({ phase: "splitting", completed: 0, total: 1 });
    const { pageCount, chunks } = await splitWholeBookPdf(file);
    onProgress({ phase: "preparing", completed: 0, total: chunks.length + 1, pageCount });
    const prepared = await callSpeakingContent(firebaseUser, "create_book_upload", {
        book_id: Number(metadata.book_id),
        document_title: metadata.document_title,
        original_filename: file.name,
        byte_size: file.size,
        page_count: pageCount,
        chunks: chunks.map(({ blob, ...chunk }) => chunk)
    });
    let completed = 0;
    try {
        await uploadPrivatePdf(prepared.original_upload, file);
        completed += 1;
        onProgress({ phase: "uploading", completed, total: chunks.length + 1, pageCount });
        await runUploadPool(prepared.chunk_uploads, 3, async upload => {
            const chunk = chunks.find(item => item.chunk_index === upload.chunk_index);
            if (!chunk) throw new Error("找不到對應的 PDF 批次");
            await uploadPrivatePdf(upload, chunk.blob);
            completed += 1;
            onProgress({ phase: "uploading", completed, total: chunks.length + 1, pageCount });
        });
        const confirmed = await callSpeakingContent(firebaseUser, "confirm_book_upload", { document_id: prepared.document_id });
        onProgress({ phase: "ready", completed: chunks.length + 1, total: chunks.length + 1, pageCount });
        return { ...confirmed, chunks: prepared.chunk_uploads };
    } catch (error) {
        await discardSpeakingSourceUpload(firebaseUser, prepared.document_id).catch(() => null);
        throw error;
    }
};

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
