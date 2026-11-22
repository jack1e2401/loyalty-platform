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
