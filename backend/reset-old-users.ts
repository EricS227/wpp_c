import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🗑️  Deletando usuários antigos da SIM Estearina...\n');
    
    // Buscar empresa
    const company = await prisma.company.findFirst({
      where: { name: { contains: 'Estearina' } },
    });
    
    if (!company) {
      console.log('❌ Empresa não encontrada');
      process.exit(1);
    }
    
    console.log(`Empresa encontrada: ${company.name}`);
    
    // Deletar usuários dessa empresa
    const deleteResult = await prisma.user.deleteMany({
      where: { 
        companyId: company.id,
        email: { contains: 'simestearina' }
      },
    });
    
    console.log(`✅ ${deleteResult.count} usuários deletados\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
