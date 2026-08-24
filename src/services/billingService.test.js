import { callEdgeFunction } from "./edgeFunctionClient";
import { syncBillingSession } from "./billingService";

jest.mock("./edgeFunctionClient", () => ({ callEdgeFunction: jest.fn() }));

test("sends the Checkout Session ID using the billing-manager contract", async () => {
    const firebaseUser = { uid: "student-1" };
    callEdgeFunction.mockResolvedValue({ success: true });

    await syncBillingSession(firebaseUser, "cs_test_example");

    expect(callEdgeFunction).toHaveBeenCalledWith("billing-manager", firebaseUser, {
        action: "sync",
        checkout_session_id: "cs_test_example"
    });
});
