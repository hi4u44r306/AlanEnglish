import fs from "fs";
import path from "path";

describe("child-friendly AI material entry", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "AIMaterialGenerator.jsx"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(__dirname, "css/AIMaterialGenerator.scss"),
    "utf8"
  );

  test("starts with a short practice choice", () => {
    expect(source).toContain("今天想練什麼？");
    expect(source).toContain("選一種練習");
  });

  test("keeps detailed quota information in a native disclosure", () => {
    expect(source).toContain('<details className="ai-quota-card">');
    expect(source).toContain('<summary className="ai-quota-heading">');
    expect(source).toContain("查看明細");
    expect(source).toContain("成功生成才扣額度");
  });

  test("keeps mobile type choices compact and touch friendly", () => {
    expect(styles).toMatch(/\.ai-type-card \{[\s\S]*min-height: 104px;/);
    expect(styles).toMatch(/\.ai-quota-card > summary \{[\s\S]*min-height: 74px;/);
  });
});
