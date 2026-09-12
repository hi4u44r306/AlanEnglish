import fs from "fs";
import path from "path";

describe("student-friendly UI foundation", () => {
  const stylesheetPath = path.join(__dirname, "StudentFriendlyUI.scss");
  const stylesheet = fs.readFileSync(stylesheetPath, "utf8");
  const appSource = fs.readFileSync(
    path.join(__dirname, "../../../app/App.jsx"),
    "utf8"
  );
  const studentNavbarStyles = fs.readFileSync(
    path.join(__dirname, "StudentNavbar.scss"),
    "utf8"
  );

  test("is loaded after page modules and scoped to the student navbar", () => {
    expect(appSource).toContain(
      'import "../components/assets/scss/StudentFriendlyUI.scss";'
    );
    expect(stylesheet).toContain(
      ".app-shell:has(.ae-student-navbar) .app-content"
    );
    expect(stylesheet).not.toMatch(/\.app-shell:has\(\.navbar-manager\)/);
  });

  test("keeps primary mobile actions touch friendly", () => {
    expect(stylesheet).toMatch(/@media \(max-width: 600px\)/);
    expect(stylesheet).toMatch(/min-height: 44px/);
  });

  test("reduces heavy student typography and mobile decoration", () => {
    expect(stylesheet).toMatch(/:where\(h1, h2, h3\)[\s\S]*font-weight: 700/);
    expect(stylesheet).toMatch(/\.student-settings-hero > span[\s\S]*display: none/);
    expect(stylesheet).toMatch(/\.platform-eyebrow[\s\S]*display: none/);
  });

  test("keeps the mobile learning surface clear of the duplicate assignment shortcut", () => {
    expect(studentNavbarStyles).toMatch(
      /body:has\(\.ae-student-bottom-nav\) \.assignment-shortcut \{ display: none; \}/
    );
  });
});
