-- Index on Transaction.userId for fast user transaction lookups
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- Index on Transaction.createdAt for time-range queries
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- Composite index on History(userId, updatedAt) for sorted history queries
CREATE INDEX "History_userId_updatedAt_idx" ON "History"("userId", "updatedAt" DESC);

-- Index on ActivationCode.createdAt for admin listing
CREATE INDEX "ActivationCode_createdAt_idx" ON "ActivationCode"("createdAt");
