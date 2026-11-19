-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allStores" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastSignedInAt" TIMESTAMP(3),
    "permissionOverrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUserStore" (
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,

    CONSTRAINT "AppUserStore_pkey" PRIMARY KEY ("userId","storeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_login_key" ON "AppUser"("login");

-- CreateIndex
CREATE INDEX "AppUserStore_storeId_idx" ON "AppUserStore"("storeId");

-- AddForeignKey
ALTER TABLE "AppUserStore" ADD CONSTRAINT "AppUserStore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUserStore" ADD CONSTRAINT "AppUserStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RoleDefault" (
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,

    CONSTRAINT "RoleDefault_pkey" PRIMARY KEY ("role")
);

INSERT INTO "RoleDefault" ("role", "permissions") VALUES
('USER', '["sign_off"]'),
('MANAGER', '["sign_off","schedule","trainees_edit","reports","export"]'),
('SUPERVISOR', '["sign_off","schedule","trainees_edit","reports","export","view_stores","users"]'),
('ADMIN', '["sign_off","schedule","trainees_edit","trainees_deactivate","paths","reports","export","view_stores","modules","roster_import","users","store_logins"]');
