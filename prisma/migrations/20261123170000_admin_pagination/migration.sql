CREATE INDEX "Content_kind_position_name_id_idx" ON "Content"("kind", "position", "name", "id");
CREATE INDEX "media_assets_created_at_id_idx" ON "media_assets"("created_at", "id");
CREATE INDEX "media_assets_original_filename_id_idx" ON "media_assets"("original_filename", "id");
