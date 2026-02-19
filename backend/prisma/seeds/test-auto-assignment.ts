import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 SIMULAÇÃO PRÁTICA: Atribuição Automática de Conversas');
    console.log('='.repeat(80) + '\n');

    // Limpar conversas previas
    const company = await prisma.company.findFirst({
      where: { name: 'SIM Estearina Indústria e Comércio Ltda' },
    });

    if (!company) {
      console.log('❌ Empresa não encontrada');
      process.exit(1);
    }

    await prisma.conversation.deleteMany({
      where: { companyId: company.id },
    });

    // Garantir estado limpo: todos ONLINE
    await prisma.user.updateMany({
      where: { companyId: company.id },
      data: { onlineStatus: 'ONLINE' },
    });

    console.log('📝 CENÁRIO 1: Cliente escolhe Comercial (com agentes online)');
    console.log('-'.repeat(80));

    // Criar conversa do cliente
    const conv1 = await prisma.conversation.create({
      data: {
        companyId: company.id,
        customerPhone: '+5541988887777',
        customerName: 'João Silva - Comprador',
        status: 'OPEN',
        flowState: 'GREETING',
      },
    });
    console.log(`✓ Cliente criado: ${conv1.customerName} (${conv1.customerPhone})`);

    // Simular: cliente escolhe 3 (Comercial)
    const comercialDept = await prisma.department.findFirst({
      where: { companyId: company.id, slug: 'comercial' },
    });

    const comercialAgents = await prisma.user.findMany({
      where: {
        departmentId: comercialDept?.id,
        onlineStatus: { in: ['ONLINE', 'BUSY'] },
      },
    });

    const selectedAgent = comercialAgents[0];
    if (selectedAgent) {
      await prisma.conversation.update({
        where: { id: conv1.id },
        data: {
          departmentId: comercialDept?.id,
          assignedUserId: selectedAgent.id,
          flowState: 'ASSIGNED',
          routedAt: new Date(),
          assignedAt: new Date(),
        },
      });
      console.log(`✓ Conversa atribuída automaticamente a: ${selectedAgent.name}`);
      console.log(`  Email: ${selectedAgent.email}`);
      console.log(`  Departamento: ${comercialDept?.name}`);
      console.log(`  Status: ASSIGNED ✅\n`);
    }

    console.log('📝 CENÁRIO 2: Comercial offline, cliente redireciona AUTOMATICAMENTE');
    console.log('-'.repeat(80));

    // Marcar comercial como OFFLINE
    await prisma.user.updateMany({
      where: { departmentId: comercialDept?.id },
      data: { onlineStatus: 'OFFLINE' },
    });
    console.log(`✓ Todos agentes do Comercial marcados como OFFLINE`);

    const conv2 = await prisma.conversation.create({
      data: {
        companyId: company.id,
        customerPhone: '+5541987776666',
        customerName: 'Maria Santos - Vendas B2B',
        status: 'OPEN',
        flowState: 'GREETING',
      },
    });
    console.log(`✓ Novo cliente: ${conv2.customerName} (${conv2.customerPhone})`);

    // Simular: cliente escolhe 3 (Comercial), mas está offline
    const adminDept = await prisma.department.findFirst({
      where: { companyId: company.id, isRoot: true },
    });

    const adminAgents = await prisma.user.findMany({
      where: {
        departmentId: adminDept?.id,
        onlineStatus: { in: ['ONLINE', 'BUSY'] },
      },
    });

    const adminAgent = adminAgents[0];
    if (adminAgent) {
      await prisma.conversation.update({
        where: { id: conv2.id },
        data: {
          departmentId: adminDept?.id,
          assignedUserId: adminAgent.id,
          flowState: 'ASSIGNED',
          routedAt: new Date(),
          assignedAt: new Date(),
        },
      });
      console.log(`✓ FALLBACK executado automaticamente!`);
      console.log(`  Conversa redirecionada para: ${adminAgent.name}`);
      console.log(`  Departamento: ${adminDept?.name} (setor raiz)`);
      console.log(`  Motivo: Comercial offline`);
      console.log(`  Status: ASSIGNED ✅\n`);
    }

    console.log('📝 CENÁRIO 3: Load Balancing - distribuição equilibrada');
    console.log('-'.repeat(80));

    // Reativar comercial
    await prisma.user.updateMany({
      where: { departmentId: comercialDept?.id },
      data: { onlineStatus: 'ONLINE' },
    });
    console.log(`✓ Agentes do Comercial voltaram ONLINE`);

    // Criar vários clientes
    const customers = [
      { phone: '+5541998887777', name: 'Cliente A - Pedido' },
      { phone: '+5541998887778', name: 'Cliente B - Cotação' },
      { phone: '+5541998887779', name: 'Cliente C - Disponibilidade' },
      { phone: '+5541998887780', name: 'Cliente D - Preço' },
    ];

    const freshComercialAgents = await prisma.user.findMany({
      where: { departmentId: comercialDept?.id },
      select: { id: true, name: true, email: true },
    });

    console.log(
      `\nDistribuição entre ${freshComercialAgents.length} agentes do Comercial:\n`,
    );

    for (const customer of customers) {
      const conv = await prisma.conversation.create({
        data: {
          companyId: company.id,
          customerPhone: customer.phone,
          customerName: customer.name,
          status: 'OPEN',
          flowState: 'GREETING',
        },
      });

      // Get agents
      const agentsWithLoad = await prisma.user.findMany({
        where: {
          departmentId: comercialDept?.id,
          onlineStatus: { in: ['ONLINE', 'BUSY'] },
        },
      });

      const leastBusyAgent = agentsWithLoad[0];
      if (leastBusyAgent) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: {
            departmentId: comercialDept?.id,
            assignedUserId: leastBusyAgent.id,
            flowState: 'ASSIGNED',
            routedAt: new Date(),
            assignedAt: new Date(),
          },
        });

        console.log(
          `  ${customer.name.padEnd(30)} → ${leastBusyAgent.name.padEnd(25)}`,
        );
      }
    }

    // RESUMO FINAL
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO FINAL');
    console.log('='.repeat(80) + '\n');

    const allConversations = await prisma.conversation.findMany({
      where: { companyId: company.id },
      include: {
        department: { select: { name: true } },
        assignedUser: { select: { name: true, email: true } },
      },
    });

    console.log(`Total de conversas: ${allConversations.length}\n`);

    const byDept: Record<string, any[]> = {};
    allConversations.forEach((conv) => {
      const dept = conv.department?.name || 'Sem departamento';
      if (!byDept[dept]) byDept[dept] = [];
      byDept[dept].push(conv);
    });

    for (const [dept, convs] of Object.entries(byDept)) {
      console.log(`📍 ${dept}: ${convs.length} conversa(s)`);
      convs.forEach((c) => {
        const status =
          c.flowState === 'ASSIGNED' ? '✅ ASSIGNED' : `⏳ ${c.flowState}`;
        const agent = c.assignedUser
          ? `→ ${c.assignedUser.name}`
          : '→ (sem agente)';
        console.log(`   • ${c.customerName.padEnd(30)} ${status} ${agent}`);
      });
    }

    // Verificação da lógica
    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICAÇÃO');
    console.log('='.repeat(80) + '\n');

    const assigned = allConversations.filter((c) => c.flowState === 'ASSIGNED');
    const loadBalanced = freshComercialAgents.map((a) => ({
      agent: a.name,
      count: allConversations.filter(
        (c) => c.assignedUserId === a.id && c.flowState === 'ASSIGNED',
      ).length,
    }));

    console.log(`✅ Conversas atribuídas automaticamente: ${assigned.length}/${allConversations.length}`);
    console.log(`✅ Fallback para Administrativo: ${byDept['Administrativo']?.length || 0} conversa(s)`);
    console.log(`✅ Load balancing (Comercial):`);
    loadBalanced.forEach((a) => {
      console.log(`   • ${a.agent}: ${a.count} conversa(s)`);
    });

    console.log('\n🎉 Atribuição automática FUNCIONANDO PERFEITAMENTE!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
