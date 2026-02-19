/**
 * reset-passwords.ts
 * Força reset da senha de todos os agentes SIM Estearina para Sim@2024
 * Seguro: não deleta dados, apenas atualiza o hash da senha
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const AGENTS = [
  'lab1@simestearina.com.br',
  'lab2@simestearina.com.br',
  'comercial1@simestearina.com.br',
  'comercial2@simestearina.com.br',
  'financeiro1@simestearina.com.br',
  'financeiro2@simestearina.com.br',
  'admin1@simestearina.com.br',
  'admin2@simestearina.com.br',
];

const NEW_PASSWORD = 'Sim@2024';

async function main() {
  console.log('\n🔐 Reset de senhas - SIM Estearina\n');

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

  let updated = 0;
  let notFound = 0;

  for (const email of AGENTS) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log(`   ⚠️  Não encontrado: ${email}`);
      notFound++;
      continue;
    }

    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        isActive: true,
      },
    });

    console.log(`   ✅ ${email} → senha redefinida`);
    updated++;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Atualizados: ${updated}`);
  if (notFound > 0) {
    console.log(`⚠️  Não encontrados: ${notFound} (rode o seed primeiro)`);
    console.log(`   → cd backend && npm run prisma:seed:setup`);
  }
  console.log(`\n🔑 Login: qualquer email acima`);
  console.log(`🔑 Senha: ${NEW_PASSWORD}`);
  console.log(`${'='.repeat(50)}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
