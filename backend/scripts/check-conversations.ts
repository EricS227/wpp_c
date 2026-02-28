import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const conversations = await prisma.conversation.count();
    const messages = await prisma.message.count();
    const simUsers = await prisma.user.count({
      where: { email: { contains: 'simestearina' } }
    });
    
    const orphanedConversations = await prisma.conversation.count({
      where: { assignedUserId: null, companyId: { contains: '' } }
    });
    
    const simConversations = await prisma.conversation.count({
      where: {
        assignedUser: {
          email: { contains: 'simestearina' }
        }
      }
    });

    console.log('\n📊 ESTATÍSTICAS DO BANCO:\n');
    console.log(`Total de Conversas: ${conversations}`);
    console.log(`Total de Mensagens: ${messages}`);
    console.log(`Usuários SIM Estearina: ${simUsers}`);
    console.log(`Conversas sem agente atribuído: ${orphanedConversations}`);
    console.log(`Conversas de usuários SIM Estearina: ${simConversations}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
