ALTER TABLE `LoyaltyPolicyVersion`
  ADD COLUMN `qualificationMode` ENUM('POINTS', 'SPEND') NULL,
  ADD COLUMN `resetEnabled` BOOLEAN NULL,
  ADD COLUMN `resetMonth` INTEGER NULL,
  ADD COLUMN `resetDay` INTEGER NULL,
  ADD COLUMN `resetStrategy` ENUM('ONE_DOWN', 'SELECTED') NULL,
  ADD COLUMN `resetTargetLevel` VARCHAR(64) NULL;
