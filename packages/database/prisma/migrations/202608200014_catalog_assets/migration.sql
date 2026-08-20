CREATE TABLE "catalog_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "resource_type" TEXT NOT NULL,
  "resource_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploaded_by" UUID NOT NULL,
  CONSTRAINT "catalog_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_assets_resource_type_check" CHECK ("resource_type" IN ('INSTITUTION', 'SPORT', 'MODALITY')),
  CONSTRAINT "catalog_assets_mime_type_check" CHECK ("mime_type" IN ('image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT "catalog_assets_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 1572864),
  CONSTRAINT "catalog_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "catalog_assets_resource_key" UNIQUE ("resource_type", "resource_id")
);

CREATE INDEX "catalog_assets_uploaded_by_idx" ON "catalog_assets"("uploaded_by");
CREATE INDEX "catalog_assets_created_at_idx" ON "catalog_assets"("created_at" DESC);
