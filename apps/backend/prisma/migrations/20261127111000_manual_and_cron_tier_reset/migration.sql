ALTER TABLE `TierResetRun`
  ADD COLUMN `cycleKey` VARCHAR(64) NULL,
  ADD COLUMN `triggerType` ENUM('SCHEDULED', 'MANUAL') NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN `seasonNumber` INT NOT NULL DEFAULT 1,
  ADD COLUMN `targetPoints` INT NOT NULL DEFAULT 0;

UPDATE `TierResetRun`
SET `cycleKey` = CONCAT('scheduled-', `cycleYear`),
    `seasonNumber` = 2
WHERE `cycleKey` IS NULL;

ALTER TABLE `TierResetRun`
  MODIFY COLUMN `cycleKey` VARCHAR(64) NOT NULL;

CREATE UNIQUE INDEX `TierResetRun_merchantId_cycleKey_key` ON `TierResetRun`(`merchantId`, `cycleKey`);
CREATE INDEX `TierResetRun_merchantId_cycleYear_triggerType_idx` ON `TierResetRun`(`merchantId`, `cycleYear`, `triggerType`);

DROP INDEX `TierResetRun_merchantId_cycleYear_key` ON `TierResetRun`;
