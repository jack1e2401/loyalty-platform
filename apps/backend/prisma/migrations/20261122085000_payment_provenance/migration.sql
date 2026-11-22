-- Copy settled VNPay identity to the durable order before the next migration removes PaymentAttempt.
ALTER TABLE `Order`
  ADD COLUMN `paymentProvider` ENUM('UNKNOWN', 'MOCK', 'VNPAY') NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `paymentProviderReference` VARCHAR(100) NULL,
  ADD COLUMN `paymentProviderTransactionNo` VARCHAR(64) NULL;

UPDATE `Order` AS o
JOIN `PaymentAttempt` AS pa ON pa.`orderId` = o.`id`
SET o.`paymentProvider` = 'VNPAY',
    o.`paymentProviderReference` = pa.`txnRef`,
    o.`paymentProviderTransactionNo` = pa.`transactionNo`
WHERE pa.`status` = 'SUCCEEDED';

-- The ledger retains the settlement source after provider attempts are removed.
UPDATE `Order` AS o
SET o.`paymentProvider` = 'VNPAY'
WHERE o.`paymentProvider` = 'UNKNOWN'
  AND EXISTS (
    SELECT 1 FROM `PointTransaction` AS pt
    WHERE pt.`orderId` = o.`id` AND pt.`source` = 'VNPAY_IPN'
  );

UPDATE `Order` AS o
SET o.`paymentProvider` = 'MOCK'
WHERE o.`paymentProvider` = 'UNKNOWN'
  AND EXISTS (
    SELECT 1 FROM `PointTransaction` AS pt
    WHERE pt.`orderId` = o.`id` AND pt.`source` = 'MOCK_PAYMENT'
  );
