import fs from "fs";
import path from "path";
import { PDFJS_WORKER_URL } from "./pdfjsLoader";

const root = path.resolve(__dirname, "..", "..");

describe("pdfjsLoader", () => {
    it("worker 檔名的版本與 package.json 的 pdfjs-dist 一致", () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
        const installed = JSON.parse(
            fs.readFileSync(path.join(root, "node_modules", "pdfjs-dist", "package.json"), "utf8")
        );
        expect(PDFJS_WORKER_URL).toContain(`pdf.worker-${pkg.dependencies["pdfjs-dist"]}.min.mjs`);
        expect(installed.version).toBe(pkg.dependencies["pdfjs-dist"]);
    });

    it("public/vendor 的 worker 與套件裡的內容完全相同", () => {
        const vendor = fs.readFileSync(path.join(root, "public", "vendor", "pdf.worker-4.10.38.min.mjs"));
        const dist = fs.readFileSync(
            path.join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs")
        );
        expect(vendor.equals(dist)).toBe(true);
    });
});
