BEGIN;

UPDATE "Content"
SET "options" = "options" - 'tags' - 'allergens'
WHERE "kind" = 'PRODUCT'
  AND jsonb_typeof("options") = 'object'
  AND "options" ?| ARRAY['tags', 'allergens'];

ALTER TABLE "dishes" DROP COLUMN "dietary_tags", DROP COLUMN "allergens";

COMMIT;
