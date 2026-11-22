-- Keep existing member and merchant identities while removing platform-only runtime records.
-- Merchant applicants without an owned Merchant become local member accounts.
UPDATE `User` AS u
LEFT JOIN `Merchant` AS m ON m.`ownerId` = u.`id`
SET u.`accountStatus` = CASE
      WHEN u.`role` = 'MERCHANT' AND m.`id` IS NULL AND u.`accountStatus` IN ('PENDING_APPROVAL', 'REJECTED') THEN 'ACTIVE'
      ELSE u.`accountStatus`
    END,
    u.`role` = 'MEMBER'
WHERE u.`role` = 'ADMIN' OR (u.`role` = 'MERCHANT' AND m.`id` IS NULL);

ALTER TABLE `User`
  MODIFY `role` ENUM('MERCHANT', 'MEMBER') NOT NULL;

-- Merchant approvals are no longer a stage; unresolved requests return to the merchant for final review.
UPDATE `RefundRequest`
SET `status` = 'PENDING_MERCHANT'
WHERE `status` = 'PENDING_ADMIN';

ALTER TABLE `RefundRequest`
  DROP FOREIGN KEY `RefundRequest_adminReviewedById_fkey`,
  MODIFY `status` ENUM('PENDING_MERCHANT', 'REJECTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING_MERCHANT';

-- These point holds only backed unconfirmed provider payment attempts; clearing them releases the hold.
UPDATE `LoyaltyWallet` SET `reservedPoints` = 0;

DROP TABLE `MerchantAbuseReport`;
DROP TABLE `AdminAuditLog`;
DROP TABLE `EmailBlacklistEntry`;
DROP TABLE `MerchantApplication`;
DROP TABLE `MerchantFeeTransaction`;
DROP TABLE `PaymentAttempt`;

ALTER TABLE `Merchant`
  DROP COLUMN `feeTier`,
  DROP COLUMN `feeTierYear`,
  DROP COLUMN `feeTierEvaluatedAt`;

ALTER TABLE `LoyaltyWallet`
  DROP COLUMN `reservedPoints`;
