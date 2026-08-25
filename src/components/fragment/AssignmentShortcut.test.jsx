import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import AssignmentShortcut from "./AssignmentShortcut";

jest.mock("../../auth/AuthContext", () => ({
    useAuth: jest.fn()
}));

const renderShortcut = (authValue, path = "/student/dashboard") => {
    useAuth.mockReturnValue(authValue);

    return render(
        <MemoryRouter initialEntries={[path]}>
            <AssignmentShortcut />
        </MemoryRouter>
    );
};

describe("AssignmentShortcut", () => {
    test("hides homework from a student without assignment access", () => {
        renderShortcut({
            isAuthenticated: true,
            role: "student",
            studentProfile: {
                membership: {
                    effective_access: {
                        features: { assignments: false }
                    }
                }
            }
        });

        expect(screen.queryByRole("link", { name: /今日作業/ })).not.toBeInTheDocument();
    });

    test("shows homework to a student with assignment access", () => {
        renderShortcut({
            isAuthenticated: true,
            role: "student",
            studentProfile: {
                membership: {
                    effective_access: {
                        features: { assignments: true }
                    }
                }
            }
        });

        expect(screen.getByRole("link", { name: /今日作業/ })).toHaveAttribute(
            "href",
            "/student/assignments"
        );
    });

    test("keeps the publish shortcut for managers", () => {
        renderShortcut({
            isAuthenticated: true,
            role: "admin",
            studentProfile: null
        }, "/admin/dashboard");

        expect(screen.getByRole("link", { name: /發布作業/ })).toHaveAttribute(
            "href",
            "/teacher/assignments"
        );
    });
});
