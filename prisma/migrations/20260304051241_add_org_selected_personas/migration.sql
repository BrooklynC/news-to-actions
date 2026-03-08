-- CreateTable
CREATE TABLE "OrgSelectedPersona" (
    "organizationId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgSelectedPersona_pkey" PRIMARY KEY ("organizationId","personaId")
);

-- CreateIndex
CREATE INDEX "OrgSelectedPersona_organizationId_idx" ON "OrgSelectedPersona"("organizationId");

-- CreateIndex
CREATE INDEX "OrgSelectedPersona_personaId_idx" ON "OrgSelectedPersona"("personaId");

-- AddForeignKey
ALTER TABLE "OrgSelectedPersona" ADD CONSTRAINT "OrgSelectedPersona_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgSelectedPersona" ADD CONSTRAINT "OrgSelectedPersona_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
