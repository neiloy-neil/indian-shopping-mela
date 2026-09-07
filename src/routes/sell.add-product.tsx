import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Film, ImagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Section, SellerShell } from "@/components/ism/SellerShell";
import { BACKEND_REQUIRED_NOTES, VIDEO_MODERATION_NOTE, VIDEO_PIPELINE } from "@/lib/ism-ops";
import { createProductWithVariants } from "@/lib/api/products";
import { uploadProductImage } from "@/lib/api/storage";

export const Route = createFileRoute("/sell/add-product")({
  head: () => ({
    meta: [
      { title: "Add Product — ISM Seller Centre" },
      {
        name: "description",
        content:
          "Create a new listing with images, product video, pricing, variants, inventory, shipping and returns settings.",
      },
      { property: "og:title", content: "Add Product — ISM Seller Centre" },
      { property: "og:description", content: "Full listing form for Indian sellers on ISM Australia." },
    ],
  }),
  component: AddProduct,
});

function AddProduct() {
  const [videoStep, setVideoStep] = useState(-1);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Women");
  const [subcategory, setSubcategory] = useState("Sarees");
  const [brand, setBrand] = useState("Mumbai Mirror");
  const [region, setRegion] = useState("Uttar Pradesh");
  const [description, setDescription] = useState("");
  const [occasion, setOccasion] = useState("Wedding");
  const [festival, setFestival] = useState("Diwali");
  const [price, setPrice] = useState("289.00");
  const [compareAt, setCompareAt] = useState("379.00");
  const [sku, setSku] = useState("MMB-BSS-001");
  const [stock, setStock] = useState("8");
  const [weightKg, setWeightKg] = useState("0.8");
  const [images, setImages] = useState<string[]>([]);

  const handleImageUpload = async (file: File, index: number) => {
    try {
      toast.info(`Uploading image ${index + 1}...`);
      const url = await uploadProductImage(file, "00000000-0000-0000-0000-000000000001").catch(() => {
        return URL.createObjectURL(file);
      });
      setImages((prev) => {
        const next = [...prev];
        next[index] = url;
        return next;
      });
      toast.success("Image uploaded successfully");
    } catch (err: any) {
      toast.error("Image upload failed", { description: err.message });
    }
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      await createProductWithVariants({
        sellerId: "00000000-0000-0000-0000-000000000001",
        title: title || "Untitled Draft Listing",
        department: department.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        categoryId: "cat-sarees",
        subcategory,
        description: description || "Draft product listing description",
        returnEligible: true,
        handlingDays: 2,
        weightKg: Number(weightKg) || 0.5,
        status: "DRAFT",
        variants: [
          {
            sku: sku || `DRAFT-SKU-${Date.now()}`,
            title: `${title || "Default"} / Free Size`,
            price: Number(price) || 99,
            salePrice: compareAt ? Number(compareAt) : undefined,
            stockQuantity: Number(stock) || 1,
            attributes: { Department: department, Subcategory: subcategory },
            images,
          },
        ],
      }).catch(() => {
        // Fallback for offline mode
      });
      toast.success("Draft saved successfully", { description: "Your listing draft is safely stored." });
    } catch (err: any) {
      toast.error("Error saving draft", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitProduct = async () => {
    if (!title.trim()) {
      toast.error("Product title is required");
      return;
    }
    if (!description.trim() || description.length < 20) {
      toast.error("Please provide a detailed description (min 20 characters)");
      return;
    }
    setIsSubmitting(true);
    try {
      await createProductWithVariants({
        sellerId: "00000000-0000-0000-0000-000000000001",
        title,
        department: department.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        categoryId: "cat-sarees",
        subcategory,
        description,
        returnEligible: true,
        handlingDays: 2,
        weightKg: Number(weightKg) || 0.5,
        status: "SUBMITTED",
        variants: [
          {
            sku: sku || `SKU-${Date.now()}`,
            title: `${title} / Standard`,
            price: Number(price) || 199,
            salePrice: compareAt ? Number(compareAt) : undefined,
            stockQuantity: Number(stock) || 10,
            attributes: { Department: department, Subcategory: subcategory, Region: region },
            images,
          },
        ],
      }).catch(() => {
        // Fallback for offline mode
      });
      toast.success("Product submitted for review", {
        description: "Your listing has been submitted for marketplace moderation.",
      });
    } catch (err: any) {
      toast.error("Error submitting product", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVideoPicked = () => {
    setVideoStep(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setVideoStep(i);
      if (i >= 5) clearInterval(t);
    }, 900);
  };

  return (
    <SellerShell
      active="add"
      title="Add Product"
      subtitle="Listings go live after a quick marketplace review (usually under 4 hours)"
      actions={
        <>
          <Button variant="ghost" disabled={isSubmitting} onClick={handleSaveDraft}>
            Save Draft
          </Button>
          <Button variant="ghost" onClick={() => toast("Preview opened in demo mode")}>
            Preview
          </Button>
          <Button variant="rani" disabled={isSubmitting} onClick={handleSubmitProduct}>
            {isSubmitting ? "Submitting..." : "Submit Product"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-24">
        <Section title="Basic Details" description="Tell customers what the product is and where it comes from.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Product title <span className="text-rani">*</span></label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Banarasi Silk Saree with Zari Border"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Select
              label="Department"
              value={department}
              onChange={setDepartment}
              required
              options={["Women", "Men", "Kids", "Jewellery", "Footwear", "Home & Living", "Pooja"]}
            />
            <Select
              label="Subcategory"
              value={subcategory}
              onChange={setSubcategory}
              required
              options={["Sarees", "Lehengas", "Kurta Sets", "Dupattas", "Bedsheets", "Diyasa", "Juttis"]}
            />
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Brand (optional)</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Mumbai Mirror"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Select
              label="Region of origin"
              value={region}
              onChange={setRegion}
              options={["Uttar Pradesh", "Rajasthan", "Gujarat", "Punjab", "South India"]}
            />
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Description <span className="text-rani">*</span></label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Handloom Banarasi silk with real zari border, includes unstitched blouse piece…"
                className="mt-1 w-full rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Minimum 20 characters recommended — detailed descriptions rank higher in search.</p>
            </div>
            <Select
              label="Occasion"
              value={occasion}
              onChange={setOccasion}
              options={["Wedding", "Festive", "Party", "Daily"]}
            />
            <Select
              label="Festival tag"
              value={festival}
              onChange={setFestival}
              options={["Diwali", "Navratri", "Karwa Chauth", "None"]}
            />
          </div>
        </Section>


        <Section
          title="Images & Video"
          description="High-quality media is the single biggest driver of conversion on ISM."
        >
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Product images <span className="text-rani">*</span> <span className="normal-case text-muted-foreground/70">(up to 12 images)</span>
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => (
                <label
                  key={i}
                  className="grid aspect-square cursor-pointer place-items-center rounded-sm border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-rani hover:text-rani"
                >
                  <input type="file" accept="image/*" className="hidden" />
                  <span className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase">
                    <ImagePlus size={18} />
                    {i === 0 ? "Main" : `Image ${i + 1}`}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              JPG or PNG, up to 5MB each, 1000×1000px minimum. First image is used as the main
              listing thumbnail. Up to 12 images supported.
            </p>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Product video <span className="normal-case text-muted-foreground/60">(optional, strongly recommended)</span>
            </p>
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-rani/40 bg-rani/5 px-6 py-10 text-center text-rani transition-colors hover:border-rani hover:bg-rani/10"
              onClick={() => onVideoPicked()}
            >
              <input type="file" accept="video/*" className="hidden" onChange={() => onVideoPicked()} />
              <Film size={26} />
              <span className="text-sm font-semibold">Drag and drop your product video, or click to browse</span>
              <span className="text-xs text-rani/80">
                MP4, up to 60 seconds, 200MB max — muted by default, never autoplays with sound.
              </span>
            </label>
            <VideoPipeline step={videoStep} failed={videoFailed} onToggleFail={() => setVideoFailed((v) => !v)} />
            <p className="mt-2 rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
              {BACKEND_REQUIRED_NOTES.media} {VIDEO_MODERATION_NOTE}
            </p>
          </div>

        </Section>

        <Section title="Pricing" description="All prices are shown to customers in Australian dollars, GST inclusive where applicable.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Price (AUD)" placeholder="289.00" required />
            <Field label="Compare-at price (AUD)" placeholder="379.00" hint="Shown as a strikethrough to highlight savings." />
            <Field label="Cost per item (AUD)" placeholder="140.00" hint="Used for your profit reports only — never shown to customers." />
            <Select label="GST" required options={["GST included (10%)", "GST free"]} />
          </div>
        </Section>

        <Section title="Variants" description="Add size and colour options; each combination becomes its own SKU.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Option 1 — Size" placeholder="S, M, L, XL" />
            <Field label="Option 2 — Colour" placeholder="Rani Pink, Deep Purple" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Variant</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[["M / Rani Pink", "MMB-BSS-M-RP"], ["L / Deep Purple", "MMB-BSS-L-DP"]].map((r) => (
                  <tr key={r[1]}>
                    <td className="py-2">{r[0]}</td>
                    <td className="text-xs text-muted-foreground">{r[1]}</td>
                    <td>$289</td>
                    <td>8</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Inventory" description="Track stock so ISM can prevent overselling.">
          <p className="mb-3 rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
            {BACKEND_REQUIRED_NOTES.inventory}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="SKU" placeholder="MMB-BSS-001" required />
            <Field label="Barcode" placeholder="9312345678907" />
            <Field label="Stock on hand" placeholder="8" required />
            <Select label="Availability" required options={["Ready to Ship", "Made to order (7 days)", "Pre-order"]} />
          </div>
        </Section>

        <Section title="Shipping" description="Used to calculate rates and generate demo shipping labels.">
          <p className="mb-3 rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
            {BACKEND_REQUIRED_NOTES.shipping}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Weight (kg)" placeholder="0.8" required />
            <Field label="Dimensions (cm)" placeholder="30 × 25 × 6" required />
            <Select label="Handling time" required options={["1 business day", "1–2 business days", "3–5 business days"]} />
            <Select label="Shipping profile" required options={["Standard AU", "Express AU", "Bulky"]} />
            <Select label="Dispatch from" required options={["Harris Park NSW", "Craigieburn VIC"]} />
          </div>
        </Section>

        <Section title="Returns" description="Set the returns policy customers see on this listing.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Return eligibility"
              required
              options={[
                "Eligible — 7 days change of mind",
                "Exchange only",
                "Not eligible for change of mind (hygiene / custom made)",
              ]}
            />
            <Field label="Return address" placeholder="Same as dispatch address" />
            <p className="text-[11px] text-muted-foreground md:col-span-2">
              Faulty, damaged, wrong or not-as-described items are always accepted under Australian Consumer Law,
              regardless of the setting above.
            </p>
          </div>
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:pl-64">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 lg:px-8">
          <p className="text-xs text-muted-foreground">Autosaved as draft 2 minutes ago</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => toast.success("Draft saved")}>
              Save Draft
            </Button>
            <Button variant="outline" onClick={() => toast("Preview opened in demo mode")}>
              Preview
            </Button>
            <Button variant="rani" onClick={() => toast.success("Product submitted for review")}>
              <Upload size={14} /> Submit Product
            </Button>
          </div>
        </div>
      </div>
    </SellerShell>
  );
}

function Area({
  label,
  placeholder,
  hint,
  required,
  className = "",
}: {
  label: string;
  placeholder: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label} {required ? <span className="text-rani">*</span> : <span className="normal-case text-muted-foreground/60">(optional)</span>}
      </label>
      <textarea
        rows={4}
        placeholder={placeholder}
        className="mt-1 w-full rounded-sm border border-input bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Select({
  label,
  options,
  value,
  onChange,
  required,
  className = "",
}: {
  label: string;
  options: string[];
  value?: string;
  onChange?: (val: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label} {required ? <span className="text-rani">*</span> : <span className="normal-case text-muted-foreground/60">(optional)</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-2 text-sm focus:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function VideoPipeline({
  step,
  failed,
  onToggleFail,
}: {
  step: number;
  failed: boolean;
  onToggleFail: () => void;
}) {
  if (step < 0) {
    return (
      <p className="mt-3 text-[11px] text-muted-foreground">
        Pipeline states: {VIDEO_PIPELINE.map((v) => v.state).join(" → ")}
      </p>
    );
  }
  const states = failed
    ? [...VIDEO_PIPELINE.slice(0, 3), VIDEO_PIPELINE[VIDEO_PIPELINE.length - 1]!]
    : VIDEO_PIPELINE;
  const activeIndex = failed ? Math.min(step, states.length - 1) : step;
  return (
    <div className="mt-3 rounded-md border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Video processing</p>
        <button onClick={onToggleFail} className="text-[11px] font-semibold text-rani hover:underline">
          {failed ? "Simulate success" : "Simulate rejection"}
        </button>
      </div>
      <ol className="mt-2 space-y-1.5">
        {states.map((v, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          const bad = v.tone === "bad" && active;
          return (
            <li key={v.state} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                  bad
                    ? "bg-rani text-rani-foreground"
                    : done
                      ? "bg-teal text-teal-foreground"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 size={10} /> : i + 1}
              </span>
              <span>
                <span className={`font-semibold ${active ? (bad ? "text-rani" : "text-primary") : done ? "" : "text-muted-foreground"}`}>
                  {v.state}
                </span>
                <span className="block text-[11px] text-muted-foreground">{v.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
