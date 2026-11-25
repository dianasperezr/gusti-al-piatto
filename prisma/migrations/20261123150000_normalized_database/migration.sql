BEGIN;

-- Preserve existing rows and UUIDs in shared tables.
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";
ALTER TABLE "Audit" DROP CONSTRAINT "Audit_userId_fkey";
ALTER TABLE "Content" DROP CONSTRAINT "Content_mediaId_fkey";
ALTER TABLE "ContentMedia" DROP CONSTRAINT "ContentMedia_mediaId_fkey";

ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";
ALTER TABLE "Media" RENAME TO "media_assets";
ALTER TABLE "media_assets" RENAME CONSTRAINT "Media_pkey" TO "media_assets_pkey";
ALTER TABLE "Audit" RENAME TO "audit_logs";
ALTER TABLE "audit_logs" RENAME CONSTRAINT "Audit_pkey" TO "audit_logs_pkey";
ALTER INDEX "Audit_createdAt_idx" RENAME TO "audit_logs_created_at_idx";
ALTER TABLE "OrderRequest" RENAME TO "order_intents";
ALTER TABLE "order_intents" RENAME CONSTRAINT "OrderRequest_pkey" TO "order_intents_pkey";
ALTER INDEX "OrderRequest_reference_key" RENAME TO "order_intents_reference_code_key";
ALTER INDEX "OrderRequest_createdAt_idx" RENAME TO "order_intents_created_at_idx";

ALTER INDEX "User_email_key" RENAME TO "users_email_key";
ALTER TABLE "users" RENAME COLUMN "active" TO "is_active";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "media_assets" RENAME COLUMN "name" TO "original_filename";
ALTER TABLE "media_assets" RENAME COLUMN "mime" TO "mime_type";
ALTER TABLE "media_assets" RENAME COLUMN "size" TO "file_size";
ALTER TABLE "media_assets" RENAME COLUMN "path" TO "storage_key";
ALTER TABLE "media_assets" RENAME COLUMN "thumbnail" TO "thumbnail_key";
ALTER TABLE "media_assets" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "audit_logs" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "audit_logs" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "order_intents" RENAME COLUMN "reference" TO "reference_code";
ALTER TABLE "order_intents" RENAME COLUMN "createdAt" TO "created_at";


-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('MXN', 'USD');

-- CreateEnum
CREATE TYPE "RoundingMode" AS ENUM ('CENT', 'WHOLE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "BundlePricingMode" AS ENUM ('FIXED', 'SUM');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_GROUP_PRICE');

-- CreateEnum
CREATE TYPE "ScheduleBehavior" AS ENUM ('HIDE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ScheduleExceptionType" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'PNG');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderItemType" AS ENUM ('DISH', 'BUNDLE', 'LEGACY');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISABLED', 'ENABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "SyncConflictStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "users"
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN password_hash DROP NOT NULL,
  ALTER COLUMN role SET DEFAULT 'EDITOR',
  ADD COLUMN updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN image TEXT;
UPDATE "users" SET updated_at = created_at;

ALTER TABLE "media_assets"
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN width INTEGER,
  ADD COLUMN height INTEGER,
  ADD COLUMN media_type "MediaType" NOT NULL DEFAULT 'IMAGE';
UPDATE "media_assets" SET media_type = 'VIDEO' WHERE mime_type LIKE 'video/%';

ALTER TABLE "audit_logs"
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid,
  ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN entity_id UUID,
  ADD COLUMN previous_data JSONB,
  ADD COLUMN new_data JSONB;

ALTER TABLE "Session" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
ALTER TABLE "Content" ALTER COLUMN "mediaId" TYPE uuid USING "mediaId"::uuid;
ALTER TABLE "ContentMedia" ALTER COLUMN "mediaId" TYPE uuid USING "mediaId"::uuid;

ALTER TABLE "order_intents"
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN customer_name TEXT,
  ADD COLUMN customer_note TEXT,
  ADD COLUMN currency_code "CurrencyCode",
  ADD COLUMN base_currency "CurrencyCode",
  ADD COLUMN exchange_rate_snapshot DECIMAL(24,12),
  ADD COLUMN subtotal_cents BIGINT,
  ADD COLUMN discount_cents BIGINT,
  ADD COLUMN total_cents BIGINT,
  ADD COLUMN whatsapp_link_generated_at TIMESTAMP(3);

UPDATE "order_intents" SET
  customer_note = NULLIF(snapshot->>'note', ''),
  currency_code = (snapshot->>'currency')::"CurrencyCode",
  base_currency = (snapshot->>'baseCurrency')::"CurrencyCode",
  exchange_rate_snapshot = (snapshot->'exchange'->>'rate')::decimal,
  subtotal_cents = (snapshot->>'subtotal')::bigint,
  discount_cents = (snapshot->>'discount')::bigint,
  total_cents = (snapshot->>'total')::bigint,
  whatsapp_link_generated_at = created_at;

ALTER TABLE "order_intents"
  ALTER COLUMN currency_code SET NOT NULL,
  ALTER COLUMN base_currency SET NOT NULL,
  ALTER COLUMN exchange_rate_snapshot SET NOT NULL,
  ALTER COLUMN subtotal_cents SET NOT NULL,
  ALTER COLUMN discount_cents SET NOT NULL,
  ALTER COLUMN total_cents SET NOT NULL;


-- CreateTable
CREATE TABLE "restaurant_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurant_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logo_media_id" UUID,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT NOT NULL,
    "background_color" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "base_currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
    "enabled_currencies" "CurrencyCode"[] DEFAULT ARRAY['MXN']::"CurrencyCode"[],
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "social_links" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "currency_code" "CurrencyCode" NOT NULL,
    "exchange_rate" DECIMAL(24,12) NOT NULL,
    "rounding_mode" "RoundingMode" NOT NULL DEFAULT 'CENT',
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image_media_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dishes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "long_description" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER NOT NULL,
    "category_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietary_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dish_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_adjustment_cents" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dish_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_modifier_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dish_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_selections" INTEGER NOT NULL DEFAULT 0,
    "max_selections" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dish_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_modifiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modifier_group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_adjustment_cents" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dish_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dish_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "alt_text" TEXT,

    CONSTRAINT "dish_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER,
    "pricing_mode" "BundlePricingMode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bundle_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bundle_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bundle_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "start_date" TIMESTAMPTZ(3) NOT NULL,
    "end_date" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "terms" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_dishes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,

    CONSTRAINT "promotion_dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_bundles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "bundle_id" UUID NOT NULL,

    CONSTRAINT "promotion_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "weekdays" INTEGER[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "behavior" "ScheduleBehavior" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_schedule_rules" (
    "dish_id" UUID NOT NULL,
    "schedule_rule_id" UUID NOT NULL,

    CONSTRAINT "dish_schedule_rules_pkey" PRIMARY KEY ("dish_id","schedule_rule_id")
);

-- CreateTable
CREATE TABLE "category_schedule_rules" (
    "category_id" UUID NOT NULL,
    "schedule_rule_id" UUID NOT NULL,

    CONSTRAINT "category_schedule_rules_pkey" PRIMARY KEY ("category_id","schedule_rule_id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "date" DATE NOT NULL,
    "start_time" TIME(0),
    "end_time" TIME(0),
    "exception_type" "ScheduleExceptionType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "header_type" TEXT NOT NULL,
    "navigation_type" TEXT NOT NULL,
    "footer_config" JSONB NOT NULL DEFAULT '{}',
    "theme_config" JSONB NOT NULL DEFAULT '{}',
    "typography_config" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "site_settings_id" UUID NOT NULL,
    "section_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_config" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "template_type" TEXT NOT NULL,
    "layout_config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "export_format" "ExportFormat" NOT NULL,
    "selected_items" JSONB NOT NULL DEFAULT '[]',
    "currency_code" "CurrencyCode" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "file_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_code" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "international_number" TEXT NOT NULL,
    "default_message" TEXT NOT NULL DEFAULT '',
    "order_button_text" TEXT NOT NULL DEFAULT 'Pedir por WhatsApp',
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_intent_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_intent_id" UUID NOT NULL,
    "item_type" "OrderItemType" NOT NULL,
    "item_id" UUID NOT NULL,
    "item_name_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" BIGINT NOT NULL,
    "subtotal_cents" BIGINT NOT NULL,
    "configuration_snapshot" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "order_intent_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISABLED',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "operation" "SyncOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "database_value" JSONB NOT NULL,
    "external_value" JSONB NOT NULL,
    "conflict_status" "SyncConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "order_intents_status_created_at_idx" ON "order_intents"("status", "created_at");

-- CreateIndex
CREATE INDEX "restaurant_settings_logo_media_id_idx" ON "restaurant_settings"("logo_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "currency_settings_currency_code_key" ON "currency_settings"("currency_code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_external_id_key" ON "categories"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_deleted_at_sort_order_idx" ON "categories"("is_active", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "categories_image_media_id_idx" ON "categories"("image_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "dishes_external_id_key" ON "dishes"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "dishes_slug_key" ON "dishes"("slug");

-- CreateIndex
CREATE INDEX "dishes_category_id_is_published_is_active_deleted_at_sort_o_idx" ON "dishes"("category_id", "is_published", "is_active", "deleted_at", "sort_order");

-- CreateIndex
CREATE INDEX "dish_variants_dish_id_sort_order_idx" ON "dish_variants"("dish_id", "sort_order");

-- CreateIndex
CREATE INDEX "dish_modifier_groups_dish_id_idx" ON "dish_modifier_groups"("dish_id");

-- CreateIndex
CREATE INDEX "dish_modifiers_modifier_group_id_sort_order_idx" ON "dish_modifiers"("modifier_group_id", "sort_order");

-- CreateIndex
CREATE INDEX "dish_media_dish_id_sort_order_idx" ON "dish_media"("dish_id", "sort_order");

-- CreateIndex
CREATE INDEX "dish_media_media_asset_id_idx" ON "dish_media"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "dish_media_dish_id_media_asset_id_key" ON "dish_media"("dish_id", "media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_external_id_key" ON "bundles"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_slug_key" ON "bundles"("slug");

-- CreateIndex
CREATE INDEX "bundles_is_published_is_active_is_featured_idx" ON "bundles"("is_published", "is_active", "is_featured");

-- CreateIndex
CREATE INDEX "bundle_items_bundle_id_sort_order_idx" ON "bundle_items"("bundle_id", "sort_order");

-- CreateIndex
CREATE INDEX "bundle_items_dish_id_idx" ON "bundle_items"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_items_bundle_id_dish_id_key" ON "bundle_items"("bundle_id", "dish_id");

-- CreateIndex
CREATE INDEX "bundle_media_bundle_id_sort_order_idx" ON "bundle_media"("bundle_id", "sort_order");

-- CreateIndex
CREATE INDEX "bundle_media_media_asset_id_idx" ON "bundle_media"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_media_bundle_id_media_asset_id_key" ON "bundle_media"("bundle_id", "media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_external_id_key" ON "promotions"("external_id");

-- CreateIndex
CREATE INDEX "promotions_active_start_date_end_date_idx" ON "promotions"("active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "promotion_dishes_dish_id_idx" ON "promotion_dishes"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_dishes_promotion_id_dish_id_key" ON "promotion_dishes"("promotion_id", "dish_id");

-- CreateIndex
CREATE INDEX "promotion_bundles_bundle_id_idx" ON "promotion_bundles"("bundle_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_bundles_promotion_id_bundle_id_key" ON "promotion_bundles"("promotion_id", "bundle_id");

-- CreateIndex
CREATE INDEX "schedule_rules_is_active_priority_idx" ON "schedule_rules"("is_active", "priority");

-- CreateIndex
CREATE INDEX "dish_schedule_rules_schedule_rule_id_idx" ON "dish_schedule_rules"("schedule_rule_id");

-- CreateIndex
CREATE INDEX "category_schedule_rules_schedule_rule_id_idx" ON "category_schedule_rules"("schedule_rule_id");

-- CreateIndex
CREATE INDEX "schedule_exceptions_date_idx" ON "schedule_exceptions"("date");

-- CreateIndex
CREATE INDEX "site_sections_site_settings_id_is_visible_sort_order_idx" ON "site_sections"("site_settings_id", "is_visible", "sort_order");

-- CreateIndex
CREATE INDEX "export_jobs_status_created_at_idx" ON "export_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "export_jobs_template_id_idx" ON "export_jobs"("template_id");

-- CreateIndex
CREATE INDEX "order_intent_items_order_intent_id_idx" ON "order_intent_items"("order_intent_id");

-- CreateIndex
CREATE INDEX "order_intent_items_item_type_item_id_idx" ON "order_intent_items"("item_type", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_integrations_provider_key" ON "sync_integrations"("provider");

-- CreateIndex
CREATE INDEX "sync_events_status_created_at_idx" ON "sync_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "sync_events_entity_type_entity_id_created_at_idx" ON "sync_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "sync_conflicts_conflict_status_created_at_idx" ON "sync_conflicts"("conflict_status", "created_at");

-- CreateIndex
CREATE INDEX "sync_conflicts_entity_type_entity_id_field_name_idx" ON "sync_conflicts"("entity_type", "entity_id", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_id_account_id_key" ON "auth_accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");

-- CreateIndex
CREATE INDEX "auth_verifications_expires_at_idx" ON "auth_verifications"("expires_at");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentMedia" ADD CONSTRAINT "ContentMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_settings" ADD CONSTRAINT "restaurant_settings_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_variants" ADD CONSTRAINT "dish_variants_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_modifier_groups" ADD CONSTRAINT "dish_modifier_groups_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_modifiers" ADD CONSTRAINT "dish_modifiers_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "dish_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_media" ADD CONSTRAINT "dish_media_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_media" ADD CONSTRAINT "dish_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_media" ADD CONSTRAINT "bundle_media_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_media" ADD CONSTRAINT "bundle_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_dishes" ADD CONSTRAINT "promotion_dishes_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_dishes" ADD CONSTRAINT "promotion_dishes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_bundles" ADD CONSTRAINT "promotion_bundles_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_bundles" ADD CONSTRAINT "promotion_bundles_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_schedule_rules" ADD CONSTRAINT "dish_schedule_rules_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_schedule_rules" ADD CONSTRAINT "dish_schedule_rules_schedule_rule_id_fkey" FOREIGN KEY ("schedule_rule_id") REFERENCES "schedule_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_schedule_rules" ADD CONSTRAINT "category_schedule_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_schedule_rules" ADD CONSTRAINT "category_schedule_rules_schedule_rule_id_fkey" FOREIGN KEY ("schedule_rule_id") REFERENCES "schedule_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_site_settings_id_fkey" FOREIGN KEY ("site_settings_id") REFERENCES "site_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "design_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_intent_items" ADD CONSTRAINT "order_intent_items_order_intent_id_fkey" FOREIGN KEY ("order_intent_id") REFERENCES "order_intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing receipts retain their exact quote, even if catalog rows disappear.
INSERT INTO order_intent_items
  (order_intent_id, item_type, item_id, item_name_snapshot, quantity, unit_price_cents, subtotal_cents, configuration_snapshot)
SELECT receipt.id,
  (CASE content.kind WHEN 'PRODUCT' THEN 'DISH' WHEN 'COMBO' THEN 'BUNDLE' ELSE 'LEGACY' END)::"OrderItemType",
  (line->>'id')::uuid, line->>'name', (line->>'quantity')::integer,
  (line->>'unit')::bigint, (line->>'subtotal')::bigint, line
FROM order_intents receipt
CROSS JOIN LATERAL jsonb_array_elements(receipt.snapshot->'lines') AS items(line)
LEFT JOIN "Content" content ON content.id = line->>'id';

ALTER TABLE currency_settings ADD CONSTRAINT currency_settings_positive_rate CHECK (exchange_rate > 0);
ALTER TABLE restaurant_settings ADD CONSTRAINT restaurant_settings_base_enabled CHECK (base_currency = ANY(enabled_currencies));
ALTER TABLE dishes ADD CONSTRAINT dishes_nonnegative_price CHECK (price_cents >= 0);
ALTER TABLE bundles ADD CONSTRAINT bundles_valid_price CHECK (
  (price_cents IS NULL OR price_cents >= 0) AND (pricing_mode <> 'FIXED' OR price_cents IS NOT NULL)
);
ALTER TABLE bundle_items ADD CONSTRAINT bundle_items_positive_quantity CHECK (quantity > 0);
ALTER TABLE dish_modifier_groups ADD CONSTRAINT dish_modifier_groups_valid_limits CHECK (
  min_selections >= 0 AND max_selections >= min_selections AND (NOT is_required OR min_selections >= 1)
);
ALTER TABLE promotions ADD CONSTRAINT promotions_valid_period CHECK (start_date <= end_date);
ALTER TABLE promotions ADD CONSTRAINT promotions_valid_discount CHECK (
  discount_value > 0 AND (discount_type <> 'PERCENTAGE' OR discount_value <= 100)
);
ALTER TABLE schedule_rules ADD CONSTRAINT schedule_rules_valid_weekdays CHECK (
  cardinality(weekdays) > 0 AND weekdays <@ ARRAY[0,1,2,3,4,5,6] AND array_position(weekdays, NULL) IS NULL
);
ALTER TABLE schedule_exceptions ADD CONSTRAINT schedule_exceptions_paired_times CHECK (
  (start_time IS NULL) = (end_time IS NULL)
);
ALTER TABLE order_intents ADD CONSTRAINT order_intents_valid_totals CHECK (
  exchange_rate_snapshot > 0 AND discount_cents >= 0 AND total_cents >= 0 AND total_cents = subtotal_cents - discount_cents
);
ALTER TABLE order_intent_items ADD CONSTRAINT order_intent_items_valid_amounts CHECK (
  quantity > 0 AND unit_price_cents >= 0 AND subtotal_cents >= 0
);
ALTER TABLE sync_events ADD CONSTRAINT sync_events_nonnegative_attempts CHECK (attempts >= 0);

CREATE UNIQUE INDEX dish_media_one_primary ON dish_media (dish_id) WHERE is_primary;
CREATE UNIQUE INDEX bundle_media_one_primary ON bundle_media (bundle_id) WHERE is_primary;

COMMIT;
