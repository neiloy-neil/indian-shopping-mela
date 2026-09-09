# Indian Shopping Mela — Storage Backup & Disaster Recovery Strategy

**Document Owner:** Infrastructure Operations  
**Classification:** Internal Operational Policy  
**Scope:** Supabase Storage Buckets (`product-media`, `seller-documents`, `return-evidence`)

---

## 1. Storage Bucket Architecture & Sensitivity Classification

| Bucket Name        | Access Level               | Data Type                                     | Encryption & Privacy                  | Backup Frequency                   |
| ------------------ | -------------------------- | --------------------------------------------- | ------------------------------------- | ---------------------------------- |
| `product-media`    | Public Read / Auth Write   | Product images, thumbnails, banners           | Standard AES-256                      | Daily mirror sync                  |
| `seller-documents` | Private (Owner/Admin only) | ABN certs, photo IDs, business registration   | Server-Side Encrypted (KMS / AES-256) | Continuous versioning + daily sync |
| `return-evidence`  | Private (Owner/Admin only) | Faulty product photos, parcel damage evidence | Server-Side Encrypted (KMS / AES-256) | Continuous versioning + daily sync |

---

## 2. Disaster Recovery & Cross-Region Mirroring Strategy (T431)

### A. Bucket Object Versioning

- Enabled on all private sensitive buckets (`seller-documents`, `return-evidence`) to prevent accidental deletion or ransomware overwrites.
- Soft-deleted objects retain 30-day lifecycle retention before permanent purge.

### B. Daily Off-Site Storage Sync

Automated daily cron synchronizes storage buckets to secondary disaster recovery S3 bucket located in `ap-southeast-1` (Singapore):

```bash
# Periodic sync script using S3 CLI / rclone
rclone sync supabase-storage:product-media dr-backup-s3:ism-prod-media-backup/product-media
rclone sync supabase-storage:seller-documents dr-backup-s3:ism-prod-media-backup/seller-documents
rclone sync supabase-storage:return-evidence dr-backup-s3:ism-prod-media-backup/return-evidence
```

### C. Storage Restoration Procedure

In the event of bucket loss or catastrophic storage failure:

1. Re-provision missing Supabase storage buckets via canonical SQL definitions.
2. Re-apply RLS storage access policies (`storage.objects` table).
3. Execute restore from secondary replica:
   ```bash
   rclone sync dr-backup-s3:ism-prod-media-backup/seller-documents supabase-storage:seller-documents
   ```
4. Verify signature URLs for private documents resolve correctly via `supabaseAdmin.storage.from(...).createSignedUrl(...)`.
