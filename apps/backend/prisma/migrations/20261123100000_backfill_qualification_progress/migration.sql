-- Preserve the pre-migration tier qualification balance for existing members.
UPDATE `MerchantMembership` AS membership
JOIN `LoyaltyWallet` AS wallet ON wallet.`membershipId` = membership.`id`
SET membership.`qualificationProgress` = wallet.`netLifetimeEarned`;
