-- Preserve the currently public configuration; drafts and version history are removed.
ALTER TABLE `Merchant` ADD COLUMN `storefrontConfig` JSON NULL;
UPDATE `Merchant` AS m
SET m.`storefrontConfig` = (
  SELECT v.`config` FROM `StorefrontConfigVersion` AS v
  WHERE v.`merchantId` = m.`id`
  ORDER BY v.`isPublished` DESC, v.`version` DESC, v.`id` DESC LIMIT 1
);
DROP TABLE `StorefrontDraft`;
DROP TABLE `StorefrontConfigVersion`;
