ALTER TABLE `TierResetRun`
  ADD COLUMN `effectiveAt` DATETIME(3) NULL;

-- Historical runs did not persist the configured cycle boundary. Preserve their recorded execution time as the best available boundary.
UPDATE `TierResetRun` SET `effectiveAt` = `completedAt` WHERE `effectiveAt` IS NULL;

ALTER TABLE `TierResetRun`
  MODIFY COLUMN `effectiveAt` DATETIME(3) NOT NULL;

ALTER TABLE `MerchantMembership`
  ADD COLUMN `lastResetAt` DATETIME(3) NULL;

UPDATE `MerchantMembership` AS membership
JOIN `TierResetRun` AS resetRun
  ON resetRun.`merchantId` = membership.`merchantId`
  AND resetRun.`cycleYear` = membership.`lastResetCycleYear`
SET membership.`lastResetAt` = resetRun.`effectiveAt`
WHERE membership.`lastResetCycleYear` IS NOT NULL;
