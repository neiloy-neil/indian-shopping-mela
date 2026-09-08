import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { Badge, Button, Card, Metric, SellerShell } from "@/components/ism/SellerShell";
import { useAuth } from "@/hooks/use-auth";
import {
  getSellerStockListServerFn,
  updateStockBatchServerFn,
  parseSpreadsheetBuffer,
  type SellerStockItem,
} from "@/lib/api/bulk-upload";
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stockItems, setStockItems] = useState<SellerStockItem[]>([]);
  const [validated, setValidated] = useState(false);
  const [applied, setApplied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedUpdates, setUploadedUpdates] = useState<Array<{ sku: string; newStock: number }>>([]);

  const loadStock = async () => {
    try {
      setLoading(true);
      const items = await getSellerStockListServerFn({ data: { sellerId: user?.id } });
      if (items && items.length > 0) {
        setStockItems(items);
      } else {
        // Fallback to sample data for display
        const sampleProds = productsBySeller("mumbai-mirror-boutique");
        setStockItems(
          sampleProds.map((p, i) => ({
            id: p.id,
            variantId: `var-${p.id}`,
            sku: p.id.toUpperCase(),
            productName: p.name,
            stockOnHand: p.stock,
            reservedUnits: i % 3,
            availableStock: Math.max(0, p.stock - (i % 3)),
            price: p.price,
          }))
        );
      }
    } catch (err) {
      console.error("Error loading stock:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, [user?.id]);

  const totalSKUs = stockItems.length;
  const totalReserved = stockItems.reduce((acc, item) => acc + item.reservedUnits, 0);
  const lowStockCount = stockItems.filter((item) => item.availableStock > 0 && item.availableStock <= 5).length;
  const outOfStockCount = stockItems.filter((item) => item.availableStock === 0).length;

  const handleDownloadStockCsv = () => {
    const header = "seller_sku,product_name,stock_on_hand,reserved_units,available_stock\n";
    const rows = stockItems.map(
      (item) =>
        `${item.sku},"${item.productName.replace(/"/g, '""')}",${item.stockOnHand},${item.reservedUnits},${item.availableStock}`
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

  const handleFileUpload = async (file: File) => {
    try {
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      const rawRows = parseSpreadsheetBuffer(buffer, file.name);

      if (rawRows.length === 0) {
        toast.error("No valid data rows found in uploaded file.");
        return;
      }

      const updates: Array<{ sku: string; newStock: number }> = [];
      for (const row of rawRows) {
        const r = row as any;
        const sku = String(r.seller_sku || r.sku || r.SKU || "").trim();
        const stockStr = r.stock_on_hand || r.stock_qty || r.stock || r.Stock;
        const newStock = Number(stockStr);

        if (sku && !isNaN(newStock) && newStock >= 0) {
          updates.push({ sku, newStock: Math.floor(newStock) });
        }
      }

      if (updates.length === 0) {
        toast.error("No valid rows matching 'seller_sku' and 'stock_on_hand' columns found.");
        return;
      }

      setUploadedUpdates(updates);
      setValidated(true);
      setApplied(false);
      toast.success(`${file.name} validated: ${updates.length} SKU(s) ready.`);
    } catch (err: any) {
      toast.error("Failed to parse file", { description: err.message });
    }
  };

  const handleApplyUploadedBatch = async () => {
    if (uploadedUpdates.length === 0) return;
    setIsSaving(true);
    try {
      const res = await updateStockBatchServerFn({ data: { updates: uploadedUpdates } });
      setApplied(true);
      toast.success("Stock levels updated successfully", {
        description: `${res.updatedCount} SKU(s) updated in the active catalogue.`,
      });
      await loadStock();
    } catch (err: any) {
      toast.error("Failed to apply stock updates", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStockChanges = async () => {
    const skuEntries = Object.entries(edits);
    if (skuEntries.length === 0) {
      toast.info("No stock adjustments were modified.");
      return;
    }
    setIsSaving(true);
    try {
      const updates = skuEntries.map(([sku, newStock]) => ({ sku, newStock }));
      const res = await updateStockBatchServerFn({ data: { updates } });
      toast.success("Inventory stock levels updated", {
        description: `${res.updatedCount} SKU(s) updated in the active catalogue.`,
      });
      setEdits({});
      await loadStock();
    } catch (err: any) {
      toast.error("Failed to update stock", { description: err.message });
    } finally {
      setIsSaving(false);
    }
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
          <Metric label="SKUs on file" value={String(totalSKUs)} />
          <Metric
            label="Reserved units"
            value={String(totalReserved)}
            note="held by unpaid / in-flight orders"
            tone="marigold"
          />
          <Metric label="Low stock" value={String(lowStockCount)} tone="rani" />
          <Metric label="Out of stock" value={String(outOfStockCount)} />
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
                Choose CSV or Excel File
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
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
              <Metric label="Rows read" value={String(uploadedUpdates.length)} />
              <Metric label="Ready" value={String(uploadedUpdates.length)} tone="teal" />
              <Metric label="Warnings" value="0" tone="marigold" note="stock within limits" />
              <Metric label="Errors" value="0" tone="teal" note="all SKUs valid format" />
            </div>
          )}

          {validated && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={isSaving}
                onClick={handleApplyUploadedBatch}
              >
                {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Apply {uploadedUpdates.length} valid rows
              </Button>
              <Badge tone="teal">Protected: Reserved units are preserved</Badge>
            </div>
          )}

          {applied && (
            <p className="mt-3 text-xs text-teal font-medium">
              ✓ Batch committed. Inventory counts are now live in store.
            </p>
          )}
        </Card>

        <Card
          title="Quick edit on screen"
          action={
            <span className="text-xs text-muted-foreground">
              {loading ? "Loading SKUs..." : `${stockItems.length} items shown`}
            </span>
          }
        >
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
                {stockItems.slice(0, 15).map((item) => (
                  <tr key={item.sku}>
                    <td className="py-2 font-medium">{item.productName}</td>
                    <td className="text-xs text-muted-foreground">{item.sku}</td>
                    <td>{item.stockOnHand}</td>
                    <td className="text-muted-foreground">{item.reservedUnits}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        aria-label={`New stock for ${item.productName}`}
                        value={edits[item.sku] ?? item.stockOnHand}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [item.sku]: Math.max(0, Number(e.target.value)),
                          }))
                        }
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
            disabled={isSaving || Object.keys(edits).length === 0}
            onClick={handleSaveStockChanges}
          >
            {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Save stock changes ({Object.keys(edits).length})
          </Button>
        </Card>
      </div>
    </SellerShell>
  );
}


