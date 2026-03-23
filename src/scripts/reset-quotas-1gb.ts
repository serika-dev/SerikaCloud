import { prisma } from "../lib/db";

async function main() {
  const GIB = 1024 * 1024 * 1024;
  const TIB = 1024 * GIB;
  
  // Update all users to 1GB limit
  await prisma.user.updateMany({
    data: {
      storageLimit: GIB,
    },
  });

  // Special case for admin@serika.dev
  await prisma.user.update({
    where: { email: "admin@serika.dev" },
    data: {
      storageLimit: TIB,
    },
  });

  console.log(`Updated users: All to 1GB, admin@serika.dev to 1TB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
