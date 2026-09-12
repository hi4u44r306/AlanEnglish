import fs from "fs";
import path from "path";

describe("child-friendly conversation layout", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "ConversationPractice.jsx"),
    "utf8"
  );
  const pageStyles = fs.readFileSync(
    path.join(__dirname, "css/ConversationPractice.scss"),
    "utf8"
  );
  const dockStyles = fs.readFileSync(
    path.join(__dirname, "../assets/scss/ConversationUXGuard.scss"),
    "utf8"
  );

  test("leads with one clear Chinese speaking task", () => {
    expect(source).toContain("英文情境對話");
    expect(source).toContain("聽問題，按下麥克風，用英文回答。");
    expect(source).toContain("按一下麥克風，用英文回答");
    expect(source).not.toContain("Meet a Foreigner");
  });

  test("puts the practice card before the long mission list on narrow screens", () => {
    expect(pageStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*\.conversation-chat-card \{[\s\S]*order: -1;/
    );
    expect(pageStyles).toMatch(
      /\.conversation-mode-options button \{[\s\S]*min-height: 44px;/
    );
  });

  test("removes the duplicate fixed answer action for student mobile navigation", () => {
    expect(dockStyles).toMatch(
      /body:has\(\.ae-student-bottom-nav\) \.conversation-action-dock \{[\s\S]*display: none;/
    );
  });
});
