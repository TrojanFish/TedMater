-- AlterTable History
ALTER TABLE "History" ADD COLUMN "thumbnail" TEXT;
ALTER TABLE "History" ADD COLUMN "talkSlug" TEXT;
ALTER TABLE "History" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable VocabWord
CREATE TABLE "VocabWord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserSentence
CREATE TABLE "UserSentence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentenceKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSentence_pkey" PRIMARY KEY ("id")
);

-- CreateTable TalkNote
CREATE TABLE "TalkNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "talkKey" TEXT NOT NULL,
    "notes" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalkNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex VocabWord_userId_word_key
CREATE UNIQUE INDEX "VocabWord_userId_word_key" ON "VocabWord"("userId", "word");

-- CreateIndex VocabWord_userId_idx
CREATE INDEX "VocabWord_userId_idx" ON "VocabWord"("userId");

-- CreateIndex UserSentence_userId_sentenceKey_key
CREATE UNIQUE INDEX "UserSentence_userId_sentenceKey_key" ON "UserSentence"("userId", "sentenceKey");

-- CreateIndex UserSentence_userId_idx
CREATE INDEX "UserSentence_userId_idx" ON "UserSentence"("userId");

-- CreateIndex TalkNote_userId_talkKey_key
CREATE UNIQUE INDEX "TalkNote_userId_talkKey_key" ON "TalkNote"("userId", "talkKey");

-- CreateIndex TalkNote_userId_idx
CREATE INDEX "TalkNote_userId_idx" ON "TalkNote"("userId");

-- CreateIndex History_userId_pinned_idx
CREATE INDEX "History_userId_pinned_idx" ON "History"("userId", "pinned");

-- AddForeignKey VocabWord_userId_fkey
ALTER TABLE "VocabWord" ADD CONSTRAINT "VocabWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey UserSentence_userId_fkey
ALTER TABLE "UserSentence" ADD CONSTRAINT "UserSentence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey TalkNote_userId_fkey
ALTER TABLE "TalkNote" ADD CONSTRAINT "TalkNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
