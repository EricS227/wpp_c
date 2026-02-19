import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const oldName = 'Empresa Demo';
  const newName = 'SIM Estearina Indústria e Comércio Ltda';

  const companies = await prisma.company.findMany({ where: { name: oldName } });
  if (companies.length === 0) {
    console.log(`Nenhuma company com nome '${oldName}' encontrada.`);
    await prisma.$disconnect();
    return;
  }

  for (const c of companies) {
    await prisma.company.update({
      where: { id: c.id },
      data: { name: newName },
    });
    console.log(`Atualizada company ${c.id}: '${oldName}' → '${newName}'`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
