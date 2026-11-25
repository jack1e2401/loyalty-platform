-- Preserve the old primary image, including legacy rows and inconsistent galleries.
CREATE TEMPORARY TABLE `_ProductImageNeedsBackfill` AS
SELECT p.`id`, p.`merchantId`, p.`imageUrl`
FROM `Product` p
WHERE p.`imageUrl` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `ProductImage` first_image
    WHERE first_image.`id` = (
      SELECT i.`id` FROM `ProductImage` i WHERE i.`productId` = p.`id` ORDER BY i.`sortOrder`, i.`id` LIMIT 1
    ) AND BINARY first_image.`url` = BINARY p.`imageUrl`
  );
CREATE TEMPORARY TABLE `_ProductImageRank` AS
SELECT i.`id`, ROW_NUMBER() OVER (PARTITION BY i.`productId` ORDER BY i.`sortOrder`, i.`id`) AS `position`
FROM `ProductImage` i JOIN `_ProductImageNeedsBackfill` p ON p.`id` = i.`productId`;
UPDATE `ProductImage` i JOIN `_ProductImageRank` r ON r.`id` = i.`id`
SET i.`sortOrder` = r.`position`;
INSERT INTO `ProductImage` (`productId`, `merchantId`, `url`, `altText`, `sortOrder`, `createdAt`)
SELECT `id`, `merchantId`, `imageUrl`, NULL, 0, CURRENT_TIMESTAMP(3)
FROM `_ProductImageNeedsBackfill`;
DROP TEMPORARY TABLE `_ProductImageRank`;
DROP TEMPORARY TABLE `_ProductImageNeedsBackfill`;
ALTER TABLE `Product` DROP COLUMN `imageUrl`;
