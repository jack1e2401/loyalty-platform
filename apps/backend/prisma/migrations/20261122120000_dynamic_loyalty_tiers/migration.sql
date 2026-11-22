-- Add merchant-defined loyalty tier fields while preserving existing tier identifiers and history.
ALTER TABLE `LoyaltyTier`
  DROP INDEX `LoyaltyTier_merchantId_minLifetimePoints_key`,
  MODIFY `level` VARCHAR(64) NOT NULL,
  MODIFY `minLifetimePoints` INT NULL,
  ADD COLUMN `name` VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN `minSpendVnd` DECIMAL(15,0) NULL,
  ADD COLUMN `sortOrder` INT NOT NULL DEFAULT 0,
  ADD COLUMN `benefits` JSON NULL,
  ADD COLUMN `iconUrl` VARCHAR(512) NULL,
  ADD COLUMN `color` CHAR(7) NOT NULL DEFAULT '#6B7280',
  ADD COLUMN `maintenanceSpendVnd` DECIMAL(15,0) NULL,
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE `LoyaltyTier`
SET `name` = CASE `level`
      WHEN 'BRONZE' THEN 'Default'
      WHEN 'SILVER' THEN 'Silver'
      WHEN 'GOLD' THEN 'Gold'
      WHEN 'PLATINUM' THEN 'Platinum'
      ELSE `level`
    END,
    `sortOrder` = CASE `level`
      WHEN 'BRONZE' THEN 0
      WHEN 'SILVER' THEN 1
      WHEN 'GOLD' THEN 2
      WHEN 'PLATINUM' THEN 3
      ELSE 0
    END,
    `benefits` = JSON_ARRAY();

UPDATE `LoyaltyTier`
SET `level` = CASE `level`
      WHEN 'BRONZE' THEN 'default'
      WHEN 'SILVER' THEN 'silver'
      WHEN 'GOLD' THEN 'gold'
      WHEN 'PLATINUM' THEN 'platinum'
      ELSE LOWER(`level`)
    END;

ALTER TABLE `LoyaltyTier`
  MODIFY `benefits` JSON NOT NULL,
  ADD INDEX `LoyaltyTier_merchantId_isActive_sortOrder_idx` (`merchantId`, `isActive`, `sortOrder`);

ALTER TABLE `PointTransaction`
  MODIFY `promotedToTier` VARCHAR(64) NULL;

ALTER TABLE `LoyaltyRule`
  ADD COLUMN `qualificationMode` ENUM('POINTS', 'SPEND') NOT NULL DEFAULT 'POINTS',
  ADD COLUMN `resetEnabled` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `resetMonth` INT NULL,
  ADD COLUMN `resetDay` INT NULL,
  ADD COLUMN `resetStrategy` ENUM('ONE_DOWN', 'SELECTED') NOT NULL DEFAULT 'ONE_DOWN',
  ADD COLUMN `resetTargetLevel` VARCHAR(64) NULL;

ALTER TABLE `MerchantMembership`
  ADD COLUMN `qualificationProgress` DECIMAL(38,12) NOT NULL DEFAULT 0,
  ADD COLUMN `tags` JSON NULL,
  ADD COLUMN `lastResetCycleYear` INT NULL;
UPDATE `MerchantMembership` SET `tags` = JSON_ARRAY();
ALTER TABLE `MerchantMembership` MODIFY `tags` JSON NOT NULL;

CREATE TABLE `TierResetRun` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `merchantId` INTEGER NOT NULL,
  `cycleYear` INTEGER NOT NULL,
  `processedCount` INTEGER NOT NULL DEFAULT 0,
  `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `TierResetRun_merchantId_cycleYear_key` (`merchantId`, `cycleYear`),
  INDEX `TierResetRun_completedAt_idx` (`completedAt`),
  CONSTRAINT `TierResetRun_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

