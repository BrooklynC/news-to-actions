-- AlterTable
ALTER TABLE "Persona" ADD COLUMN     "recipeType" "RecipeType" DEFAULT 'EXEC_BRIEF';

-- CreateTable
CREATE TABLE "TopicPersona" (
    "topicId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicPersona_pkey" PRIMARY KEY ("topicId","personaId")
);

-- CreateIndex
CREATE INDEX "TopicPersona_topicId_idx" ON "TopicPersona"("topicId");

-- CreateIndex
CREATE INDEX "TopicPersona_personaId_idx" ON "TopicPersona"("personaId");

-- AddForeignKey
ALTER TABLE "TopicPersona" ADD CONSTRAINT "TopicPersona_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicPersona" ADD CONSTRAINT "TopicPersona_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
