import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Badge, Button, Card, Metric, SellerShell } from "@/components/ism/SellerShell";
import { DEMO_NOTE } from "@/lib/ism-ops";
import { productsBySeller } from "@/lib/ism-data";

export const Route = createFileRoute("/sell/bulk-stock")({
  head: () => ({
    meta: [
      { title: "Bulk Stock Update — ISM Seller Centre" },
      {
        name: "description",
        content:
          "Update stock levels across many SKUs at once: download the current stock sheet, upload changes, validate rows and apply safely.",
      },
      { property: "og:title", content: "Bulk Stock Update — ISM Seller Centre" },
      { property: "og:description", content: "Fast, validated stock updates for ISM sellers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BulkStockPage,
});

function BulkStockPage() {
  const products = productsBySeller("mumbai-mirror-boutique");
  const [validated, setValidated] = useState(false);
  const [applied, setApplied] = useState(false);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDownloadStockCsv = () => {
    const header = "seller_sku,product_name,stock_on_hand,reserved_units,available_stock\n";
    const rows = products.map(
      (p, i) => `${p.id.toUpperCase()},"${p.name}",${p.stock},${i % 3},${Math.max(0, p.stock - (i % 3))}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + header + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ISM_Stock_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Stock sheet CSV downloaded successfully.");
  };

  const handleSaveStockChanges = () => {
    const count = Object.keys(edits).length;
    if (count === 0) {
      toast.info("No stock adjustments were modified.");
      return;
    }
    toast.success("Inventory stock levels updated", {
      description: `${count} SKU(s) updated in the active catalogue.`,
    });
    setEdits({});
  };

  return (
    <SellerShell
      active="stock"
      title="Bulk Stock Update"
      subtitle="Adjust stock across many SKUs · reserved units are protected"
      actions={
        <>
          <Button variant="outline" onClick={handleDownloadStockCsv}>
            <Download size={13} /> Current stock CSV
          </Button>
          <Link
            to="/sell/bulk-upload"
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground"
          >
            <Upload size={13} /> Full product import
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="SKUs on file" value="248" />
          <Metric label="Reserved units" value="34" note="held by unpaid / in-flight orders" tone="marigold" />
          <Metric label="Low stock" value="12" tone="rani" />
          <Metric label="Out of stock" value="3" />
        </div>

        <Card title="Upload a stock sheet">
          <div className="rounded-sm border-2 border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">Drag & drop a CSV or XLSX stock file</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Required columns: seller_sku, stock_on_hand. Optional: low_stock_threshold, backorder.
              Max 5,000 rows per file. Blank cells are ignored — they never clear a stock value.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <label className="cursor-pointer inline-flex items-center rounded-sm bg-rani px-4 py-2 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:bg-rani/90">
                Choose CSV File
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileName(file.name);
                      setValidated(true);
                      setApplied(false);
                      toast.success(`${file.name} validated: 248 SKUs ready.`);
                    }
                  }}
                />
              </label>
              <Button variant="outline" onClick={handleDownloadStockCsv}>
                Download template
              </Button>
            </div>
            {fileName && <p className="mt-2 text-xs text-primary font-medium">Selected: {fileName}</p>}
          </div>

          {validated && (
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Rows read" value="248" />
              <Metric label="Ready" value="245" tone="teal" />
              <Metric label="Warnings" value="3" tone="marigold" note="stock below threshold" />
              <Metric label="Errors" value="0" tone="teal" note="all SKUs matched" />
            </div>
          )}

          {validated && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setApplied(true);
                  toast.success("Stock levels updated successfully", {
                    description: "245 SKUs updated · batch STK-2026-0042 committed to catalogue.",
                  });
                }}
              >
                Apply 245 valid rows
              </Button>
              <Button
                variant="outline"
                onClick={() => toast.info("No errors detected in current batch.")}
              >
                Download error report
              </Button>
              <Badge tone="teal">Protected: Reserved units are preserved</Badge>
            </div>
          )}

          {applied && (
            <p className="mt-3 text-xs text-teal font-medium">
              ✓ Batch STK-2026-0042 applied. Inventory counts are now live in store.
            </p>
          )}
        </Card>

        <Card title="Quick edit on screen" action={<span className="text-xs text-muted-foreground">{products.length} items shown</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">On hand</th>
                  <th className="pb-2">Reserved</th>
                  <th className="pb-2">New stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.slice(0, 8).map((p, i) => (
                  <tr key={p.id}>
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="text-xs text-muted-foreground">{p.id.toUpperCase()}</td>
                    <td>{p.stock}</td>
                    <td className="text-muted-foreground">{i % 3}</td>
                    <td>
                      <input
                        type="number"
                        aria-label={`New stock for ${p.name}`}
                        value={edits[p.id] ?? p.stock}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                        className="h-8 w-24 rounded-sm border border-input bg-surface px-2 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            className="mt-4"
            variant="primary"
            onClick={handleSaveStockChanges}
          >
            Save stock changes
          </Button>
        </Card>
      </div>
    </SellerShell>
  );
}

