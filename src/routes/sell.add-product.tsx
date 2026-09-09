import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Film, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Section, SellerShell } from "@/components/ism/SellerShell";
import { BACKEND_REQUIRED_NOTES, VIDEO_MODERATION_NOTE } from "@/lib/ism-ops";
import { createProductWithVariants, uploadProductMedia } from "@/lib/api/products";
import { getCurrentSellerProfile } from "@/lib/api/sellers";
import { useAuth } from "@/hooks/use-auth";

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
  const { user } = useAuth();
  const [resolvedSellerId, setResolvedSellerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Women");
  const [subcategory, setSubcategory] = useState("Sarees");
  const [fabric, setFabric] = useState("Banarasi Silk");
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSeller() {
      try {
        const seller = await getCurrentSellerProfile();
        if (seller?.id) {
          setResolvedSellerId(seller.id);
        } else if (user?.id) {
          setResolvedSellerId(user.id);
        }
      } catch (err) {
        console.error("Error resolving seller profile:", err);
      }
    }
    fetchSeller();
  }, [user?.id]);

  const sellerId = resolvedSellerId ?? user?.id ?? "00000000-0000-0000-0000-000000000001";

  const handleImageUpload = async (file: File, index: number) => {
    setUploadingImageIndex(index);
    try {
      toast.info(`Uploading image ${index + 1}...`);
      const url = await uploadProductMedia(file, sellerId);
      setImages((prev) => {
        const next = [...prev];
        next[index] = url;
        return next;
      });
      toast.success(`Image ${index + 1} uploaded`);
    } catch (err: any) {
      toast.error("Image upload failed", { description: err.message });
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleVideoUpload = async (file: File) => {
    // 1. Validate file size (100MB limit per §11 GAP-11)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video file is too large", {
        description: "Maximum allowable video size is 100MB.",
      });
      return;
    }

    // 2. Validate file format
    if (!file.type.includes("mp4") && !file.name.toLowerCase().endsWith(".mp4")) {
      toast.error("Invalid video format", {
        description: "Please upload an MP4/H.264 video file.",
      });
      return;
    }

    // 3. Validate video duration (5 to 60 seconds)
    setIsUploadingVideo(true);
    try {
      const tempUrl = URL.createObjectURL(file);
      const duration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          resolve(video.duration);
        };
        video.onerror = () => {
          reject(new Error("Unable to read video metadata."));
        };
        video.src = tempUrl;
      });

      if (duration < 5 || duration > 60) {
        toast.error("Invalid video duration", {
          description: `Video must be between 5 and 60 seconds long (detected: ${Math.round(duration)}s).`,
        });
        URL.revokeObjectURL(tempUrl);
        setIsUploadingVideo(false);
        return;
      }

      toast.info("Uploading product video to media repository...");
      const url = await uploadProductMedia(file, sellerId);
      setVideoUrl(url);
      toast.success("Product video uploaded successfully", {
        description: `${Math.round(duration)}s video attached (pending automated marketplace moderation).`,
      });
    } catch (err: any) {
      toast.error("Video upload failed", { description: err.message });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    try {
      await createProductWithVariants({
        sellerId,
        title: title || "Untitled Draft Listing",
        department: department.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        subcategory,
        description: description || "Draft product listing description",
        status: "DRAFT",
        price: Number(price) || 99,
        salePrice: compareAt ? Number(compareAt) : undefined,
        stockQuantity: Number(stock) || 1,
        variants: [
          {
            sku: sku || `DRAFT-SKU-${Date.now()}`,
            title: `${title || "Default"} / Free Size`,
            price: Number(price) || 99,
            salePrice: compareAt ? Number(compareAt) : undefined,
            stockQuantity: Number(stock) || 1,
            attributes: { Department: department, Subcategory: subcategory, Fabric: fabric, Region: region },
            images,
          },
        ],
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
        sellerId,
        title,
        department: department.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        subcategory,
        description,
        status: "SUBMITTED",
        price: Number(price) || 199,
        salePrice: compareAt ? Number(compareAt) : undefined,
        stockQuantity: Number(stock) || 10,
        variants: [
          {
            sku: sku || `SKU-${Date.now()}`,
            title: `${title} / Standard`,
            price: Number(price) || 199,
            salePrice: compareAt ? Number(compareAt) : undefined,
            stockQuantity: Number(stock) || 10,
            attributes: { Department: department, Subcategory: subcategory, Fabric: fabric, Region: region, Occasion: occasion },
            images,
          },
        ],
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

  return (
    <SellerShell
      active="add"
      title="Add Product"
      subtitle="Listings go live after a quick marketplace review (usually under 4 hours)"
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSaveDraft} disabled={isSubmitting}>
            Save Draft
          </Button>
          <Button variant="rani" onClick={handleSubmitProduct} disabled={isSubmitting}>
            <Upload size={14} /> Submit Product
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-24">
        <Section title="Basic Details" description="Core product information shown in search and product pages.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Product title <span className="text-rani">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Pure Banarasi Katan Silk Saree with Antique Zari Work"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Select
              label="Department"
              value={department}
              onChange={setDepartment}
              required
              options={["Women", "Men", "Kids", "Jewellery", "Pooja Essentials", "Home & Living", "Footwear"]}
            />
            <Select
              label="Subcategory"
              value={subcategory}
              onChange={setSubcategory}
              required
              options={["Sarees", "Lehengas", "Kurtas", "Necklace Sets", "Bangles", "Juttis", "Diyas & Mandir"]}
            />
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Fabric / Material <span className="text-rani">*</span>
              </label>
              <input
                value={fabric}
                onChange={(e) => setFabric(e.target.value)}
                placeholder="e.g. Banarasi Katan Silk"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Select
              label="Craft Region"
              value={region}
              onChange={setRegion}
              options={["Uttar Pradesh", "Rajasthan", "Gujarat", "Tamil Nadu", "West Bengal", "Maharashtra", "Punjab"]}
            />
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Description <span className="text-rani">*</span>
              </label>
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
              {Array.from({ length: 12 }, (_, i) => {
                const imgUrl = images[i];
                const isCurrentUploading = uploadingImageIndex === i;

                return (
                  <div key={i} className="relative aspect-square">
                    {imgUrl ? (
                      <div className="group relative size-full overflow-hidden rounded-sm border border-border bg-surface">
                        <img src={imgUrl} alt={`Product preview ${i + 1}`} className="size-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(i)}
                          className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink/75 text-surface opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-rani px-1.5 py-0.5 text-[9px] font-bold uppercase text-rani-foreground">
                            Main
                          </span>
                        )}
                      </div>
                    ) : (
                      <label className="grid size-full cursor-pointer place-items-center rounded-sm border border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-rani hover:text-rani">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, i);
                          }}
                        />
                        <span className="flex flex-col items-center gap-1 text-[10px] font-semibold uppercase">
                          {isCurrentUploading ? (
                            <Loader2 size={18} className="animate-spin text-rani" />
                          ) : (
                            <ImagePlus size={18} />
                          )}
                          {i === 0 ? "Main" : `Image ${i + 1}`}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
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
            {videoUrl ? (
              <div className="relative max-w-md overflow-hidden rounded-md border border-border bg-black">
                <video src={videoUrl} controls className="aspect-video w-full" />
                <button
                  type="button"
                  onClick={() => setVideoUrl(null)}
                  className="absolute right-2 top-2 rounded-full bg-ink/80 p-1 text-white hover:bg-ink"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-rani/40 bg-rani/5 px-6 py-10 text-center text-rani transition-colors hover:border-rani hover:bg-rani/10">
                <input
                  type="file"
                  accept="video/mp4,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                />
                {isUploadingVideo ? (
                  <Loader2 size={26} className="animate-spin text-rani" />
                ) : (
                  <Film size={26} />
                )}
                <span className="text-sm font-semibold">
                  {isUploadingVideo ? "Uploading video..." : "Drag and drop your product video, or click to browse"}
                </span>
                <span className="text-xs text-rani/80">
                  MP4, up to 60 seconds, 20MB max — uploaded directly to secure CDN.
                </span>
              </label>
            )}
            <p className="mt-2 rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
              {BACKEND_REQUIRED_NOTES.media} {VIDEO_MODERATION_NOTE}
            </p>
          </div>
        </Section>

        <Section title="Pricing" description="All prices are shown to customers in Australian dollars, GST inclusive where applicable.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Price (AUD) <span className="text-rani">*</span>
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="289.00"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Compare-at price (AUD)
              </label>
              <input
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder="379.00"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
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
                {[["M / Rani Pink", `${sku}-M-RP`], ["L / Deep Purple", `${sku}-L-DP`]].map((r) => (
                  <tr key={r[1]}>
                    <td className="py-2">{r[0]}</td>
                    <td className="text-xs text-muted-foreground">{r[1]}</td>
                    <td>${price}</td>
                    <td>{stock}</td>
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
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                SKU <span className="text-rani">*</span>
              </label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="MMB-BSS-001"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Field label="Barcode" placeholder="9312345678907" />
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Stock on hand <span className="text-rani">*</span>
              </label>
              <input
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="8"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Select label="Availability" required options={["Ready to Ship", "Made to order (7 days)", "Pre-order"]} />
          </div>
        </Section>

        <Section title="Shipping" description="Used to calculate rates and generate real shipping labels.">
          <p className="mb-3 rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
            {BACKEND_REQUIRED_NOTES.shipping}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Weight (kg) <span className="text-rani">*</span>
              </label>
              <input
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="0.8"
                className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Field label="Dimensions (cm)" placeholder="30 × 25 × 6" required />
            <Select label="Handling time" required options={["1 business day", "1–2 business days", "3–5 business days"]} />
            <Select label="Shipping profile" required options={["Standard AU", "Express AU", "Bulky"]} />
            <Select label="Dispatch from" required options={["Harris Park NSW 2150", "Craigieburn VIC 3064"]} />
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
          <p className="text-xs text-muted-foreground">Autosaved draft</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={handleSaveDraft} disabled={isSubmitting}>
              Save Draft
            </Button>
            <Button variant="rani" onClick={handleSubmitProduct} disabled={isSubmitting}>
              <Upload size={14} /> Submit Product
            </Button>
          </div>
        </div>
      </div>
    </SellerShell>
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
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
