ALTER TABLE `Merchant` ADD COLUMN `storeProfile` JSON NULL;

UPDATE `Merchant` AS m
JOIN `StorefrontConfigVersion` AS v
  ON v.`merchantId` = m.`id` AND v.`isPublished` = true
SET m.`storeProfile` = JSON_EXTRACT(v.`config`, '$.branding')
WHERE JSON_TYPE(JSON_EXTRACT(v.`config`, '$.branding')) = 'OBJECT';
