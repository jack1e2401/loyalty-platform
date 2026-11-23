CREATE TABLE `OrderRequest` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `merchantId` INTEGER NOT NULL,
  `memberId` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(128) NOT NULL,
  `payloadHash` CHAR(64) NOT NULL,
  `orderId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `OrderRequest_orderId_key` (`orderId`),
  UNIQUE INDEX `OrderRequest_merchantId_memberId_idempotencyKey_key` (`merchantId`, `memberId`, `idempotencyKey`),
  INDEX `OrderRequest_memberId_createdAt_idx` (`memberId`, `createdAt`),
  CONSTRAINT `OrderRequest_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderRequest_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;