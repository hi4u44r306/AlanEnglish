import { getStudentNotificationDestination } from "./studentNotificationRoutes";

describe("student notification routes", () => {
    it("routes membership notifications to their page and leaves retired social notifications unlinked", () => {
        expect(getStudentNotificationDestination({ notification_type: "social", metadata: { friendship_id: 8 } }))
            .toBeNull();
        expect(getStudentNotificationDestination({ metadata: { target_path: "/student/friends" } })).toBeNull();
        expect(getStudentNotificationDestination({ notification_type: "membership" }))
            .toBe("/student/membership");
    });

    it("uses an allow-listed target path and rejects external or unknown destinations", () => {
        expect(getStudentNotificationDestination({ metadata: { target_path: "/student/assignments" } }))
            .toBe("/student/assignments");
        expect(getStudentNotificationDestination({ metadata: { target_path: "https://example.com/steal" } }))
            .toBeNull();
        expect(getStudentNotificationDestination({ notification_type: "unknown" }))
            .toBeNull();
    });
});
