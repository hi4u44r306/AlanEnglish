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
        // Windows 的 autocrlf 檢出會把換行轉成 CRLF，所以比對前先統一換行。
        const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
        const vendor = read(path.join(root, "public", "vendor", "pdf.worker-4.10.38.min.mjs"));
        const dist = read(
            path.join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs")
        );
        expect(vendor === dist).toBe(true);
    });
});
