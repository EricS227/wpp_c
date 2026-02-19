import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyName = 'SIM Estearina Indústria e Comércio Ltda';
  const company = await prisma.company.findFirst({ where: { name: companyName } });
  if (!company) {
    console.log('Company not found:', companyName);
    await prisma.$disconnect();
    return;
  }

  console.log('Cleaning data for company:', company.id);

  // Order matters due to FK constraints: messages -> assignments -> conversations
  const delMessages = await prisma.message.deleteMany({ where: { conversation: { companyId: company.id } } });
  console.log(`Deleted messages: ${delMessages.count}`);

  const delAssignments = await prisma.assignment.deleteMany({ where: { conversation: { companyId: company.id } } });
  console.log(`Deleted assignments: ${delAssignments.count}`);

  const delConvs = await prisma.conversation.deleteMany({ where: { companyId: company.id } });
  console.log(`Deleted conversations: ${delConvs.count}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
