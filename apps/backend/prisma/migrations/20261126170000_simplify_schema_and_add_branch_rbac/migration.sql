-- DropForeignKey
ALTER TABLE `challengelimitnotice` DROP FOREIGN KEY `ChallengeLimitNotice_challengeId_fkey`;

-- DropForeignKey
ALTER TABLE `challengelimitnoticeread` DROP FOREIGN KEY `ChallengeLimitNoticeRead_memberId_fkey`;

-- DropForeignKey
ALTER TABLE `challengelimitnoticeread` DROP FOREIGN KEY `ChallengeLimitNoticeRead_noticeId_fkey`;

-- DropForeignKey
ALTER TABLE `challengemilestone` DROP FOREIGN KEY `ChallengeMilestone_challengeId_fkey`;

-- DropForeignKey
ALTER TABLE `orderrefund` DROP FOREIGN KEY `OrderRefund_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `orderrefund` DROP FOREIGN KEY `OrderRefund_requestedById_fkey`;

-- DropForeignKey
ALTER TABLE `ordervoucherreservation` DROP FOREIGN KEY `OrderVoucherReservation_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `ordervoucherreservation` DROP FOREIGN KEY `OrderVoucherReservation_voucherId_fkey`;

-- DropForeignKey
ALTER TABLE `refundreconciliationattempt` DROP FOREIGN KEY `RefundReconciliationAttempt_recordedById_fkey`;

-- DropForeignKey
ALTER TABLE `refundreconciliationattempt` DROP FOREIGN KEY `RefundReconciliationAttempt_refundRequestId_fkey`;

-- DropForeignKey
ALTER TABLE `rewardcancellation` DROP FOREIGN KEY `RewardCancellation_cancelledById_fkey`;

-- DropForeignKey
ALTER TABLE `rewardcancellation` DROP FOREIGN KEY `RewardCancellation_voucherId_fkey`;

-- DropForeignKey
ALTER TABLE `rewardfulfillment` DROP FOREIGN KEY `RewardFulfillment_fulfilledById_fkey`;

-- DropForeignKey
ALTER TABLE `rewardfulfillment` DROP FOREIGN KEY `RewardFulfillment_voucherId_fkey`;

-- DropIndex
DROP INDEX `MemberVoucher_rewardProductIdSnapshot_status_idx` ON `membervoucher`;

-- DropIndex
DROP INDEX `RefundRequest_adminReviewedById_fkey` ON `refundrequest`;

-- AlterTable
ALTER TABLE `challenge` ADD COLUMN `milestones` JSON NULL;

-- AlterTable
ALTER TABLE `loyaltytier` ALTER COLUMN `name` DROP DEFAULT;

-- AlterTable
ALTER TABLE `membervoucher` ADD COLUMN `cancelReason` VARCHAR(255) NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledById` INTEGER NULL,
    ADD COLUMN `fulfilledAt` DATETIME(3) NULL,
    ADD COLUMN `fulfilledAtBranchId` INTEGER NULL,
    ADD COLUMN `fulfilledById` INTEGER NULL,
    ADD COLUMN `fulfillmentNote` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `branchId` INTEGER NULL;

-- AlterTable
ALTER TABLE `pointtransaction` MODIFY `source` ENUM('MOCK_PAYMENT', 'VNPAY_IPN', 'MEMBER_REDEMPTION', 'MERCHANT_REFUND', 'MERCHANT_REWARD_CANCELLATION', 'MERCHANT_ADJUSTMENT', 'LEGACY_BACKFILL', 'SYSTEM', 'CHALLENGE_REWARD', 'CHALLENGE_REFUND') NOT NULL DEFAULT 'LEGACY_BACKFILL';

-- AlterTable
ALTER TABLE `refundrequest` DROP COLUMN `adminDecisionReason`,
    DROP COLUMN `adminReviewedAt`,
    DROP COLUMN `adminReviewedById`;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `staffRole` ENUM('OWNER', 'MANAGER', 'CASHIER') NULL;

-- DropTable
DROP TABLE `challengelimitnotice`;

-- DropTable
DROP TABLE `challengelimitnoticeread`;

-- DropTable
DROP TABLE `challengemilestone`;

-- DropTable
DROP TABLE `orderrefund`;

-- DropTable
DROP TABLE `ordervoucherreservation`;

-- DropTable
DROP TABLE `refundreconciliationattempt`;

-- DropTable
DROP TABLE `rewardcancellation`;

-- DropTable
DROP TABLE `rewardfulfillment`;

-- CreateTable
CREATE TABLE `Branch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `merchantId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Branch_code_key`(`code`),
    INDEX `Branch_merchantId_status_idx`(`merchantId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BranchAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BranchAssignment_branchId_idx`(`branchId`),
    UNIQUE INDEX `BranchAssignment_userId_branchId_key`(`userId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucherId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Reservation_voucherId_key`(`voucherId`),
    UNIQUE INDEX `Reservation_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefundOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `status` ENUM('PENDING_PROVIDER', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING_PROVIDER',
    `amountVnd` DECIMAL(15, 0) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `requestedById` INTEGER NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `providerReference` VARCHAR(191) NULL,

    UNIQUE INDEX `RefundOrder_orderId_key`(`orderId`),
    INDEX `RefundOrder_requestedById_idx`(`requestedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `MemberVoucher_fulfilledById_idx` ON `MemberVoucher`(`fulfilledById`);

-- CreateIndex
CREATE INDEX `MemberVoucher_fulfilledAtBranchId_idx` ON `MemberVoucher`(`fulfilledAtBranchId`);

-- CreateIndex
CREATE INDEX `MemberVoucher_cancelledById_idx` ON `MemberVoucher`(`cancelledById`);

-- CreateIndex
CREATE INDEX `Order_branchId_idx` ON `Order`(`branchId`);

-- AddForeignKey
ALTER TABLE `Branch` ADD CONSTRAINT `Branch_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BranchAssignment` ADD CONSTRAINT `BranchAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BranchAssignment` ADD CONSTRAINT `BranchAssignment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberVoucher` ADD CONSTRAINT `MemberVoucher_fulfilledById_fkey` FOREIGN KEY (`fulfilledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberVoucher` ADD CONSTRAINT `MemberVoucher_fulfilledAtBranchId_fkey` FOREIGN KEY (`fulfilledAtBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberVoucher` ADD CONSTRAINT `MemberVoucher_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `MemberVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundOrder` ADD CONSTRAINT `RefundOrder_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundOrder` ADD CONSTRAINT `RefundOrder_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
