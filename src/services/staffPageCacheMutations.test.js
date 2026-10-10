import { callEdgeFunction } from "./edgeFunctionClient";
import { getManagedAccounts, grantMembershipAccess } from "./membershipService";
import { clearStaffPageCache, fetchStaffPageCache, readStaffPageCache, readStaffView, writeStaffView } from "./staffPageCache";
jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));
const user = { uid: "admin-a" }, scope = "admin-a|admin|1";
beforeEach(() => { clearStaffPageCache(); jest.clearAllMocks(); });
test("confirmed grants invalidate staff display without dropping search preferences", async () => { await fetchStaffPageCache(scope, "accounts", () => ({ accounts: [1] })); writeStaffView(scope, "accounts", { page: 2 }); callEdgeFunction.mockResolvedValue({ success: true }); await grantMembershipAccess(user, { student_id: 7, duration_days: 30 }); expect(callEdgeFunction).toHaveBeenCalledWith("membership-manager", user, { action: "admin_grant_access", student_id: 7, duration_days: 30 }); expect(readStaffPageCache(scope, "accounts").stale).toBe(true); expect(readStaffView(scope, "accounts")).toEqual({ page: 2 }); });
test("read and failed write keep the existing snapshot freshness", async () => { await fetchStaffPageCache(scope, "accounts", () => ({ accounts: [1] })); callEdgeFunction.mockResolvedValue({ accounts: [1] }); await getManagedAccounts(user); expect(readStaffPageCache(scope, "accounts").stale).toBe(false); callEdgeFunction.mockRejectedValue(new Error("failed")); await expect(grantMembershipAccess(user, {})).rejects.toThrow(); expect(readStaffPageCache(scope, "accounts").stale).toBe(false); });
