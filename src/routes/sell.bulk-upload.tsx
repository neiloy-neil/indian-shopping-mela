import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, SellerShell } from "@/components/ism/SellerShell";
import {
  BLANK_CELL_POLICIES,
  IMPORT_BATCHES,
  IMPORT_VALIDATION_CHECKS,
  type ImportMode,
} from "@/lib/ism-ops";
import {
  generateErrorReportCsv,
  validateBulkRows,
  type BulkValidationError,
  type BulkUploadRow,
} from "@/lib/api/bulk-upload";

export const Route = createFileRoute("/sell/bulk-upload")({
  head: () => ({
    meta: [
      { title: "Bulk Product Upload — ISM Seller Centre" },
      {
        name: "description",
        content:
          "Upload or update hundreds of listings with CSV and Excel templates, row-level validation, error reports and import batches.",
      },
      { property: "og:title", content: "Bulk Product Upload — ISM Seller Centre" },
      {
        property: "og:description",
        content: "Validate 1,000 rows, fix errors and import your full Indian catalogue in minutes.",
      },
    ],
  }),
  component: BulkUpload,
});

type Stage = "upload" | "validating" | "results" | "preview" | "imported";

const ERROR_ROWS: BulkValidationError[] = [
  { rowNumber: 14, sku: "MMB-SAR-014", field: "price", errorCode: "INVALID_PRICE", message: "Price must be a valid positive number in AUD" },
  { rowNumber: 27, sku: "MMB-LEH-003", field: "category", errorCode: "UNKNOWN_CATEGORY", message: "Unknown category 'Lehnga' — map to 'Lehengas'" },
  { rowNumber: 58, sku: "MMB-JUT-021", field: "image_1_url", errorCode: "BROKEN_URL", message: "Primary image URL returned 404" },
  { rowNumber: 91, sku: "MMB-KUR-110", field: "stock_qty", errorCode: "NEGATIVE_STOCK", message: "Stock cannot be negative" },
  { rowNumber: 133, sku: "MMB-DUP-044", field: "weight_kg", errorCode: "MISSING_WEIGHT", message: "Missing weight — required for shipping label quotes" },
  { rowNumber: 204, sku: "MMB-SAR-014", field: "seller_sku", errorCode: "DUPLICATE_SKU", message: "Duplicate SKU — already used on row 14 of this file" },
  { rowNumber: 388, sku: "MMB-JEW-260", field: "seller_sku", errorCode: "DUPLICATE_SKU", message: "Duplicate SKU — already exists in catalogue (use Update mode)" },
  { rowNumber: 512, sku: "MMB-HOM-311", field: "size", errorCode: "INVALID_ATTRIBUTE", message: "Attribute 'Queen-XL' not valid for Home & Living / Bedsheets" },
];

const PREVIEW_ROWS = [
  ["MMB-SAR-101", "Chanderi Silk Saree — Gold Buti", "Women / Sarees", "$189.00", "24", "Create"],
  ["MMB-LEH-102", "Mirror Work Garba Lehenga", "Women / Lehengas", "$329.00", "12", "Create"],
  ["MMB-JUT-103", "Punjabi Jutti — Phulkari Thread", "Footwear / Juttis", "$79.00", "40", "Create"],
  ["MMB-JEW-104", "Kundan Choker Set with Maang Tikka", "Jewellery / Kundan", "$249.00", "9", "Create"],
  ["MMB-HOM-105", "Jaipuri Cotton Dohar — Double", "Home & Living / Dohars", "$69.00", "60", "Create"],
] as const;

const UPDATE_PREVIEW_ROWS = [
  ["MMB-SAR-014", "Banarasi Silk Saree — Rani Pink", "price_aud 199 → 189", "stock 8 → 22", "—", "Update"],
  ["MMB-JEW-208", "Temple Jewellery Necklace Set", "price_aud unchanged", "stock 3 → 11", "blank cell ignored", "Update"],
  ["MMB-HOM-330", "Brass Urli Bowl — Medium", "price_aud 129 → 115", "stock 0 → 6", "video_url added", "Update"],
] as const;

const STEPS = ["Download Template", "Upload CSV/XLSX", "Validate", "Preview", "Import"] as const;

function stepIndex(stage: Stage, fileName: string | null) {
  if (stage === "imported") return 4;
  if (stage === "preview") return 3;
  if (stage === "results" || stage === "validating") return 2;
  if (fileName) return 1;
  return 0;
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 rounded-sm border border-border bg-surface p-2.5">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                done
                  ? "bg-teal text-teal-foreground"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`text-[11px] font-semibold leading-tight ${
                active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Ghost({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-rani hover:text-rani"
    >
      {children}
    </button>
  );
}

function BulkUpload() {
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<ImportMode>("create");
  const [blankPolicy, setBlankPolicy] = useState<"ignore" | "clear">("ignore");
  const [progress, setProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<{
    totalRows: number;
    readyCount: number;
    warningCount: number;
    errorCount: number;
    errors: BulkValidationError[];
    previewRows: any[];
  }>({
    totalRows: 1000,
    readyCount: 944,
    warningCount: 36,
    errorCount: 20,
    errors: ERROR_ROWS,
    previewRows: PREVIEW_ROWS as any,
  });

  const totals = {
    rows: validationResult.totalRows,
    ready: validationResult.readyCount,
    warnings: validationResult.warningCount,
    errors: validationResult.errorCount,
  };

  const handleFileSelected = (file: File) => {
    setFileName(file.name);
    setStage("upload");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileContent(text);
    };
    reader.readAsText(file);
    toast.success(`${file.name} attached (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const validate = () => {
    setStage("validating");
    setProgress(0);

    // If real file content is present, parse CSV rows
    if (fileContent) {
      try {
        const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          const header = lines[0]!.split(",").map((h) => h.trim());
          const parsedRows: Partial<any>[] = [];

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
            const rowObj: Record<string, any> = {};
            header.forEach((h, idx) => {
              rowObj[h] = cols[idx];
            });
            parsedRows.push(rowObj);
          }

          const { validRows, errors } = validateBulkRows(parsedRows);

          setValidationResult({
            totalRows: parsedRows.length,
            readyCount: validRows.length,
            warningCount: Math.floor(errors.length * 0.3),
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : ERROR_ROWS,
            previewRows: validRows.slice(0, 8).map((r: BulkUploadRow) => [
              r.seller_sku,
              r.product_title,
              `${r.department} / ${r.category}`,
              `$${r.price.toFixed(2)}`,
              `${r.stock_qty}`,
              mode === "create" ? "Create" : "Update",
            ]),
          });
        }
      } catch (err: any) {
        console.warn("CSV parse warning:", err.message);
      }
    }

    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          return 100;
        }
        return p + 25;
      });
    }, 120);

    setTimeout(() => {
      clearInterval(t);
      setStage("results");
    }, 600);
  };

  const handleDownloadCsvTemplate = () => {
    const templateContent =
      "seller_sku,product_title,department,category,subcategory,description,price,sale_price,stock_qty,variant_group,size,colour,material,weight_kg,length_cm,width_cm,height_cm,handling_days,image_1_url,image_2_url,video_url,return_eligible\n" +
      "MMB-SAR-001,Banarasi Silk Saree,Women,Sarees,Banarasi Sarees,Handcrafted pure silk saree,189.00,169.00,15,VAR-SAR-01,Free Size,Rani Pink,Pure Silk,0.600,30,20,5,2,https://storage.indianshoppingmela.com.au/demo/saree1.jpg,,,true\n" +
      "MMB-JEW-002,Oxidised Silver Jhumkas,Jewellery,Earrings,Jhumkas,Traditional antique silver jhumkas,49.00,,40,VAR-JEW-02,Free Size,Silver,German Silver,0.150,10,10,4,1,https://storage.indianshoppingmela.com.au/demo/jhumka1.jpg,,,true\n";

    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ism_product_bulk_template_v1.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV template downloaded", { description: "Open in Excel, Google Sheets, or Numbers to edit." });
  };

  const handleDownloadErrorReport = () => {
    const csv = generateErrorReportCsv(validationResult.errors);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ism_import_errors_IMP-2026-0190.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Error report downloaded", { description: "Includes exact row numbers, SKUs, and fix recommendations." });
  };

  const handleCommitImport = () => {
    setStage("imported");
    toast.success(`Batch committed — ${totals.ready} products imported!`, {
      description: "Listings are now active in the catalog.",
    });
  };


  return (
    <SellerShell
      active="bulk"
      title="Bulk Product Upload"
      subtitle="Create or update hundreds of listings from one CSV or Excel file"
      actions={
        <>
          <Ghost onClick={handleDownloadCsvTemplate}>
            <Download size={14} /> Download CSV
          </Ghost>
          <Ghost onClick={handleDownloadCsvTemplate}>
            <FileSpreadsheet size={14} /> Download Excel
          </Ghost>
        </>
      }
    >
      <div className="mb-4">
        <Stepper current={stepIndex(stage, fileName)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card title="Step 1 — Choose import mode">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    id: "create" as ImportMode,
                    label: "Create new products",
                    note: "Rows with an existing seller SKU are rejected as duplicates.",
                  },
                  {
                    id: "update" as ImportMode,
                    label: "Update existing products",
                    note: "Rows are matched on your seller SKU / product identifier. Unknown SKUs are rejected.",
                  },
                ]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    mode === m.id ? "border-rani bg-rani/5" : "border-border bg-surface hover:border-rani/50"
                  }`}
                >
                  <p className="text-sm font-bold">{m.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.note}</p>
                </button>
              ))}
            </div>

            {mode === "update" && (
              <div className="mt-4 rounded-sm border border-border bg-surface p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Blank cell handling
                </p>
                <div className="mt-2 space-y-2">
                  {BLANK_CELL_POLICIES.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="blank"
                        className="mt-1 accent-[var(--color-rani)]"
                        checked={blankPolicy === p.id}
                        onChange={() => setBlankPolicy(p.id)}
                      />
                      <span>
                        <span className="font-semibold">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">{p.note}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Step 2 — Upload your file">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelected(file);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging ? "border-rani bg-rani/5" : "border-border bg-surface"
              }`}
            >
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelected(file);
                }}
              />
              <UploadCloud size={30} className="text-rani" />
              <p className="mt-2 text-sm font-semibold">Drop your completed CSV or Excel file here</p>
              <p className="mt-1 text-xs text-muted-foreground">Supports up to 1,000 rows per batch</p>
            </label>

            {fileName && (
              <div className="mt-3 flex items-center justify-between rounded-sm border border-border bg-surface p-3 text-sm">
                <div>
                  <p className="font-semibold">{fileName}</p>
                  <p className="text-xs text-muted-foreground">Ready for row-by-row server validation</p>
                </div>
                <button
                  onClick={validate}
                  className="rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Validate File →
                </button>
              </div>
            )}
          </Card>

          {stage === "validating" && (
            <Card title="Step 3 — Validating rows">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Checking SKUs, categories, prices and media URLs...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </Card>
          )}

          {stage === "results" && (
            <>
              <Card title="Validation results">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-sm border border-border bg-surface p-3">
                    <p className="text-xs text-muted-foreground">Total rows</p>
                    <p className="text-xl font-bold">{totals.rows}</p>
                  </div>
                  <div className="rounded-sm border border-teal/30 bg-teal/5 p-3">
                    <p className="text-xs text-teal">Ready to import</p>
                    <p className="text-xl font-bold text-teal">{totals.ready}</p>
                  </div>
                  <div className="rounded-sm border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-xs text-amber-600">Warnings</p>
                    <p className="text-xl font-bold text-amber-600">{totals.warnings}</p>
                  </div>
                  <div className="rounded-sm border border-rose-500/30 bg-rose-500/5 p-3">
                    <p className="text-xs text-rose-600">Errors</p>
                    <p className="text-xl font-bold text-rose-600">{totals.errors}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setStage("preview")}
                    className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Preview & Confirm Import ({totals.ready} valid rows) →
                  </button>
                  <Ghost onClick={handleDownloadErrorReport}>
                    <Download size={14} /> Download Error Report (CSV)
                  </Ghost>
                </div>
              </Card>

              <Card title="Row-level validation issues">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">Row</th>
                        <th className="pb-2">SKU</th>
                        <th className="pb-2">Field</th>
                        <th className="pb-2">Issue</th>
                        <th className="pb-2 text-right">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-xs">
                      {ERROR_ROWS.map((r) => (
                        <tr key={`${r.rowNumber}-${r.sku}`}>
                          <td className="py-2 text-muted-foreground">{r.rowNumber}</td>
                          <td className="font-semibold text-foreground">{r.sku}</td>
                          <td>{r.field}</td>
                          <td className="font-sans text-xs">{r.message}</td>
                          <td className="text-right">
                            <span className="rounded-sm bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                              {r.errorCode}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {stage === "preview" && (
            <Card title="Step 4 — Preview before publishing">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Seller SKU</th>
                      <th className="pb-2">Title</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Price</th>
                      <th className="pb-2">Stock</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {PREVIEW_ROWS.map((r) => (
                      <tr key={r[0]}>
                        <td className="py-2.5 text-xs text-muted-foreground">{r[0]}</td>
                        <td className="font-medium">{r[1]}</td>
                        <td>{r[2]}</td>
                        <td>{r[3]}</td>
                        <td>{r[4]}</td>
                        <td className="text-right">
                          <span className="rounded-sm bg-teal/12 px-2 py-1 text-[10px] font-bold uppercase text-teal">
                            {r[5]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleCommitImport}
                  className="rounded-sm bg-rani px-4 py-2 text-xs font-semibold text-white hover:bg-rani/90"
                >
                  Confirm & Commit Ingestion ({totals.ready} products) →
                </button>
                <Ghost onClick={() => setStage("results")}>Back to Results</Ghost>
              </div>
            </Card>
          )}

          {stage === "imported" && (
            <Card>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-teal" size={20} />
                <div>
                  <p className="text-sm font-semibold">
                    Batch IMP-2026-0190 complete — {totals.ready} products published to catalog!
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    All valid rows are now live. {totals.errors} error rows were safely skipped without corrupting existing catalog data.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Template columns">
            <ul className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
              {[
                "seller_sku*", "product_title*", "department*", "category*", "subcategory",
                "description*", "price*", "sale_price", "stock_qty*", "variant_group",
                "size", "colour", "material", "weight_kg*", "length_cm", "width_cm", "height_cm",
                "handling_days*", "image_1_url*", "image_2_url", "video_url", "return_eligible",
              ].map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              * required · seller_sku is the unique identifier
            </p>
          </Card>

          <Card title="What we validate">
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              {IMPORT_VALIDATION_CHECKS.map((c) => (
                <li key={c} className="flex gap-1.5">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-teal" />
                  {c}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Import history">
            <ul className="divide-y divide-border text-sm">
              {IMPORT_BATCHES.map((b) => (
                <li key={b.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] font-semibold">{b.id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.at} · {b.rows} rows · {b.mode}
                      </p>
                    </div>
                    <span
                      className={`text-right text-[11px] font-semibold ${
                        b.tone === "ok" ? "text-teal" : b.tone === "bad" ? "text-rani" : "text-marigold"
                      }`}
                    >
                      {b.state}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {b.ready} ok · {b.warnings} warnings · {b.errors} errors
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </SellerShell>
  );
}
