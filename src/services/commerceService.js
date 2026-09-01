import { callEdgeFunction, callPublicEdgeFunction } from "./edgeFunctionClient";

const callCommerce = (firebaseUser, action, payload = {}) => callEdgeFunction("commerce-manager", firebaseUser, { action, ...payload });

export const loadMaterialPackages = firebaseUser => callPublicEdgeFunction("commerce-manager", { action: "packages" }, firebaseUser);
export const loadPlacementAssessment = firebaseUser => callPublicEdgeFunction("commerce-manager", { action: "placement_assessment" }, firebaseUser);
export const submitPlacementAssessment = (answers, assessmentId, firebaseUser) => callPublicEdgeFunction("commerce-manager", { action: "submit_placement", assessment_id: assessmentId, answers }, firebaseUser);
export const loadStudentCommerceProfile = firebaseUser => callCommerce(firebaseUser, "student_profile");
export const loadCommerceAdmin = firebaseUser => callCommerce(firebaseUser, "staff_bootstrap");
export const previewClassMaterials = (firebaseUser, payload) => callCommerce(firebaseUser, "preview_class_materials", payload);
export const saveClassMaterials = (firebaseUser, payload) => callCommerce(firebaseUser, "save_class_materials", { ...payload, confirmed: true });
export const saveMaterialPackage = (firebaseUser, payload) => callCommerce(firebaseUser, "save_package", payload);
export const publishMaterialPackage = (firebaseUser, id) => callCommerce(firebaseUser, "publish_package", { id });
export const discontinueMaterialPackage = (firebaseUser, id) => callCommerce(firebaseUser, "discontinue_package", { id });
export const grantStudentBook = (firebaseUser, studentId, bookId) => callCommerce(firebaseUser, "grant_book", { student_id: studentId, book_id: bookId });
export const loadStudentLifecycle = (firebaseUser, studentId) => callCommerce(firebaseUser, "student_detail", { student_id: studentId });
export const previewDeparture = (firebaseUser, studentId, effectiveDate) => callCommerce(firebaseUser, "departure_preview", { student_id: studentId, effective_date: effectiveDate });
export const scheduleDeparture = (firebaseUser, studentId, effectiveDate, reason) => callCommerce(firebaseUser, "schedule_departure", { student_id: studentId, effective_date: effectiveDate, reason, confirmed: true });
export const cancelDeparture = (firebaseUser, studentId) => callCommerce(firebaseUser, "cancel_departure", { student_id: studentId });
export const restoreStudent = (firebaseUser, studentId) => callCommerce(firebaseUser, "restore_student", { student_id: studentId });
export const processDeparture = (firebaseUser, studentId) => callCommerce(firebaseUser, "process_departure", { student_id: studentId });
