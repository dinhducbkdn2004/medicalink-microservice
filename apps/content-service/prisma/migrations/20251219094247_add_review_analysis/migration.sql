-- CreateTable
CREATE TABLE "review_analyses" (
    "id" TEXT NOT NULL,
    "doctor_id" VARCHAR(27) NOT NULL,
    "date_range" VARCHAR(10) NOT NULL,
    "include_non_public" BOOLEAN NOT NULL DEFAULT false,
    "period1_total" INTEGER NOT NULL,
    "period1_avg" DOUBLE PRECISION NOT NULL,
    "period2_total" INTEGER NOT NULL,
    "period2_avg" DOUBLE PRECISION NOT NULL,
    "total_change" INTEGER NOT NULL,
    "avg_change" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "advantages" TEXT NOT NULL,
    "disadvantages" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "created_by" VARCHAR(27) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_review_analysis_doctor_created" ON "review_analyses"("doctor_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_review_analysis_date_range" ON "review_analyses"("date_range");
