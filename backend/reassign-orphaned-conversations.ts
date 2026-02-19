import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n🔧 REATRIBUINDO CONVERSAS ORFANADAS...\n');

    // Buscar todas as conversas orfanadas (sem agente)
    const orphaned = await prisma.conversation.findMany({
      where: { assignedUserId: null },
      include: {
        department: true,
        messages: true,
      },
    });

    console.log(`📋 Encontradas ${orphaned.length} conversas orfanadas\n`);

    let reatributed = 0;

    for (const conversation of orphaned) {
      if (!conversation.departmentId) {
        console.log(`⏭️  Pulando conversa sem departamento`);
        continue;
      }

      // Buscar um agente disponível neste departamento
      const availableAgent = await prisma.user.findFirst({
        where: {
          departmentId: conversation.departmentId,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' }, // Pega o primeiro agente do departamento
      });

      if (availableAgent) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { assignedUserId: availableAgent.id },
        });

        console.log(`✅ Conversa "${conversation.customerName || conversation.customerPhone}" → ${availableAgent.name}`);
        reatributed++;
      } else {
        console.log(`⚠️  Nenhum agente disponível em ${conversation.department?.name}`);
      }
    }

    console.log(`\n✅ ${reatributed}/${orphaned.length} conversas reatribuídas\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
