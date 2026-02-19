import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n🔧 ATRIBUINDO DEPARTAMENTO ÀS CONVERSAS ORFANADAS...\n');

    // Buscar a primeira empresa (SIM Estearina)
    const company = await prisma.company.findFirst({
      where: { name: { contains: 'Estearina' } },
    });

    if (!company) {
      console.log('❌ Empresa não encontrada');
      process.exit(1);
    }

    // Buscar um departamento padrão (Administrativo geralmente é root)
    const defaultDepartment = await prisma.department.findFirst({
      where: {
        companyId: company.id,
        isRoot: true,
      },
    });

    if (!defaultDepartment) {
      console.log('❌ Departamento padrão não encontrado');
      process.exit(1);
    }

    console.log(`📍 Usando departamento: ${defaultDepartment.name}\n`);

    // Buscar conversas sem departamento
    const orphanedWithoutDept = await prisma.conversation.findMany({
      where: {
        departmentId: null,
        assignedUserId: null,
      },
      include: { messages: true },
    });

    console.log(`📋 Encontradas ${orphanedWithoutDept.length} conversas sem departamento\n`);

    let updated = 0;

    for (const conversation of orphanedWithoutDept) {
      // Buscar um agente disponível no departamento padrão
      const availableAgent = await prisma.user.findFirst({
        where: {
          departmentId: defaultDepartment.id,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (availableAgent) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            departmentId: defaultDepartment.id,
            assignedUserId: availableAgent.id,
          },
        });

        console.log(`✅ Conversa "${conversation.customerName || conversation.customerPhone}" → ${defaultDepartment.name} / ${availableAgent.name}`);
        updated++;
      } else {
        console.log(`⚠️  Nenhum agente disponível em ${defaultDepartment.name}`);
      }
    }

    console.log(`\n✅ ${updated}/${orphanedWithoutDept.length} conversas atribuídas\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
