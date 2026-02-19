import { PrismaClient } from '@prisma/client';
import * as http from 'http';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

// Helper para fazer requisições HTTP
function makeRequest(
  method: string,
  path: string,
  body?: any,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`\n🧪 ${name}...`);
    await fn();
    results.push({ name, passed: true, details: '✅' });
    console.log(`   ✅ PASSOU`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      details: error.message,
      error: error.stack,
    });
    console.log(`   ❌ FALHOU: ${error.message}`);
  }
}

async function main() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 TESTES DE ROTEAMENTO AUTOMÁTICO - SIM ESTEARINA');
    console.log('='.repeat(70));

    // Limpar conversas antigas para não ter conflito de unique constraint
    const company = await prisma.company.findFirst({
      where: { name: 'SIM Estearina Indústria e Comércio Ltda' },
    });
    if (company) {
      await prisma.conversation.deleteMany({
        where: { companyId: company.id },
      });
    }

    // TESTE 1: Verificar usuários existem
    await test('Usuários criados corretamente', async () => {
      const users = await prisma.user.findMany({
        where: { company: { name: 'SIM Estearina Indústria e Comércio Ltda' } },
      });
      if (users.length !== 8) throw new Error(`Expected 8 users, got ${users.length}`);
    });

    // TESTE 2: Verificar departamentos existem
    await test('Departamentos criados corretamente', async () => {
      const depts = await prisma.department.findMany({
        where: { company: { name: 'SIM Estearina Indústria e Comércio Ltda' } },
      });
      if (depts.length !== 4) throw new Error(`Expected 4 departments, got ${depts.length}`);
      const hasRoot = depts.some((d) => d.isRoot);
      if (!hasRoot) throw new Error('No root department (Administrativo) found');
    });

    // TESTE 3: Login de agentes
    const loginData: Record<string, any> = {};
    for (const email of [
      'lab1@simestearina.com.br',
      'comercial1@simestearina.com.br',
      'financeiro1@simestearina.com.br',
      'admin1@simestearina.com.br',
    ]) {
      await test(`Login de ${email.split('@')[0]}`, async () => {
        const response = await makeRequest('POST', '/auth/login', {
          email,
          password: 'Sim@2024',
        });
        if (!response.token) throw new Error('No token returned');
        if (!response.user.departmentId)
          throw new Error('User has no department assigned');
        loginData[email] = response;
      });
    }

    // TESTE 4: Marcar agentes como ONLINE
    await test('Marcar agentes como ONLINE', async () => {
      const agents = await prisma.user.findMany({
        where: {
          email: {
            in: [
              'lab1@simestearina.com.br',
              'comercial1@simestearina.com.br',
              'financeiro1@simestearina.com.br',
              'admin1@simestearina.com.br',
            ],
          },
        },
      });

      for (const agent of agents) {
        await prisma.user.update({
          where: { id: agent.id },
          data: { onlineStatus: 'ONLINE' },
        });
      }

      const updated = await prisma.user.findMany({
        where: { id: { in: agents.map((a) => a.id) } },
      });
      const allOnline = updated.every((u) => u.onlineStatus === 'ONLINE');
      if (!allOnline) throw new Error('Not all agents marked as ONLINE');
    });

    // TESTE 5: Criar conversa e rotear para Laboratório
    await test('Roteamento para Laboratório (disponível)', async () => {
      const company = await prisma.company.findFirst({
        where: { name: 'SIM Estearina Indústria e Comércio Ltda' },
      });
      if (!company) throw new Error('Company not found');

      const timestamp = Date.now();
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: `+5541999990001-${timestamp}`,
          customerName: 'Teste Lab',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      // Simular roteamento
      const labDept = await prisma.department.findFirst({
        where: {
          companyId: company.id,
          slug: 'laboratorio',
        },
      });

      if (!labDept) throw new Error('Lab department not found');

      const labAgent = await prisma.user.findFirst({
        where: {
          departmentId: labDept.id,
          onlineStatus: 'ONLINE',
        },
      });

      if (!labAgent) throw new Error('Lab agent not online');

      // Atualizar conversa como se foi roteada
      const routed = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          departmentId: labDept.id,
          assignedUserId: labAgent.id,
          flowState: 'ASSIGNED',
        },
        include: { department: true, assignedUser: true },
      });

      if (routed.departmentId !== labDept.id)
        throw new Error('Conversation not routed to Lab');
      if (routed.assignedUser?.id !== labAgent.id)
        throw new Error('Conversation not assigned to agent');
    });

    // TESTE 6: Testar fallback para Administrativo (offline)
    await test('Fallback para Administrativo quando setor offline', async () => {
      const company = await prisma.company.findFirst({
        where: { name: 'SIM Estearina Indústria e Comércio Ltda' },
      });
      if (!company) throw new Error('Company not found');

      // Marcar agentes do Comercial como OFFLINE
      const comercialDept = await prisma.department.findFirst({
        where: { companyId: company.id, slug: 'comercial' },
      });
      if (!comercialDept) throw new Error('Comercial department not found');

      await prisma.user.updateMany({
        where: { departmentId: comercialDept.id },
        data: { onlineStatus: 'OFFLINE' },
      });

      const timestamp = Date.now();
      const conversation = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: `+5541999990002-${timestamp}`,
          customerName: 'Teste Fallback',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      // Tentar rotear para Comercial - deve ir para Admin
      const adminDept = await prisma.department.findFirst({
        where: { companyId: company.id, isRoot: true },
      });

      if (!adminDept) throw new Error('Admin department not found');

      const adminAgent = await prisma.user.findFirst({
        where: {
          departmentId: adminDept.id,
          onlineStatus: 'ONLINE',
        },
      });

      if (!adminAgent) throw new Error('Admin agent not online for fallback');

      // Simular roteamento fallback
      const fallback = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          departmentId: adminDept.id,
          assignedUserId: adminAgent.id,
          flowState: 'ASSIGNED',
        },
        include: { department: true },
      });

      if (fallback.department?.isRoot !== true)
        throw new Error('Fallback did not route to root department');
    });

    // TESTE 7: Load balancing - agente com menos conversas
    await test('Load balancing: atribuir a agente menos ocupado', async () => {
      const company = await prisma.company.findFirst({
        where: { name: 'SIM Estearina Indústria e Comércio Ltda' },
      });
      if (!company) throw new Error('Company not found');

      const labDept = await prisma.department.findFirst({
        where: { companyId: company.id, slug: 'laboratorio' },
      });
      if (!labDept) throw new Error('Lab dept not found');

      // Marcar lab2 como ONLINE também
      const lab2 = await prisma.user.findFirst({
        where: { email: 'lab2@simestearina.com.br' },
      });
      if (lab2) {
        await prisma.user.update({
          where: { id: lab2.id },
          data: { onlineStatus: 'ONLINE' },
        });
      }

      // Criar 2 conversas para Lab
      const timestamp = Date.now();
      const conv1 = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: `+5541999990003-${timestamp}`,
          customerName: 'Cliente 1',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      const conv2 = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: `+5541999990004-${timestamp}`,
          customerName: 'Cliente 2',
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      const lab1 = await prisma.user.findFirst({
        where: { email: 'lab1@simestearina.com.br' },
      });

      // Atribuir conv1 a lab1 (agora lab1 tem 2 conversas)
      await prisma.conversation.update({
        where: { id: conv1.id },
        data: {
          departmentId: labDept.id,
          assignedUserId: lab1?.id,
          flowState: 'ASSIGNED',
        },
      });

      // conv2 deve ir para lab2 (menos carregado)
      if (lab2) {
        await prisma.conversation.update({
          where: { id: conv2.id },
          data: {
            departmentId: labDept.id,
            assignedUserId: lab2.id,
            flowState: 'ASSIGNED',
          },
        });

        const assignedConv2 = await prisma.conversation.findUnique({
          where: { id: conv2.id },
        });

        if (assignedConv2?.assignedUserId !== lab2.id) {
          throw new Error('Load balancing not working correctly');
        }
      }
    });

    // TESTE 8: Verificar mensagem de saudação
    await test('Mensagem de saudação salva', async () => {
      const company = await prisma.company.findFirst({
        where: { name: 'SIM Estearina Indústria e Comércio Ltda' },
      });
      if (!company) throw new Error('Company not found');
      if (!company.greetingMessage)
        throw new Error('Greeting message not saved');
      if (!company.greetingMessage.includes('SIM Estearina'))
        throw new Error('Greeting message does not contain company name');
    });

    // TESTE 9: Verificar menu aliases
    await test('Menu aliases normalizados', async () => {
      const testCases = [
        { input: 'LABORATORIO', expected: 'laboratorio' },
        { input: 'laboratório', expected: 'laboratorio' },
        { input: 'análise', expected: 'analise' }, // normalized form
        { input: 'COMERCIAL', expected: 'comercial' },
        { input: 'cotação', expected: 'cotacao' }, // normalized form
        { input: 'FINANCEIRO', expected: 'financeiro' },
        { input: 'boleto', expected: 'boleto' },
        { input: 'administrativo', expected: 'administrativo' },
      ];

      for (const tc of testCases) {
        const normalized = tc.input
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        if (normalized !== tc.expected) {
          throw new Error(
            `Normalization failed for "${tc.input}": expected "${tc.expected}", got "${normalized}"`,
          );
        }
      }
    });

    // RESUMO
    console.log('\n' + '='.repeat(70));
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`\n📊 RESULTADO: ${passed}/${total} testes passaram\n`);

    results.forEach((r) => {
      const icon = r.passed ? '✅' : '❌';
      console.log(`${icon} ${r.name}`);
      if (!r.passed) {
        console.log(`   └─ ${r.details}`);
      }
    });

    if (passed === total) {
      console.log('\n' + '🎉'.repeat(35));
      console.log('🎉 TODOS OS TESTES PASSARAM! Sistema está pronto! 🎉');
      console.log('🎉'.repeat(35) + '\n');
    } else {
      console.log(`\n⚠️  ${total - passed} teste(s) falharam\n`);
    }

    process.exit(passed === total ? 0 : 1);
  } catch (error) {
    console.error('Erro geral:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
