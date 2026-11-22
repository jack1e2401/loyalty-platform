CREATE TABLE `RefundReconciliationAttempt` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `refundRequestId` INTEGER NOT NULL,
  `recordedById` INTEGER NOT NULL,
  `providerReference` VARCHAR(191) NOT NULL,
  `providerTransactionNo` VARCHAR(64) NULL,
  `outcome` ENUM('FAILED', 'SETTLED') NOT NULL,
  `failureReason` VARCHAR(255) NULL,
  `requestHash` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RefundRecon_request_created_idx` (`refundRequestId`, `createdAt`),
  UNIQUE INDEX `RefundRecon_request_providerRef_key` (`refundRequestId`, `providerReference`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RefundReconciliationAttempt_refundRequestId_fkey`
    FOREIGN KEY (`refundRequestId`) REFERENCES `RefundRequest` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RefundReconciliationAttempt_recordedById_fkey`
    FOREIGN KEY (`recordedById`) REFERENCES `User` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
