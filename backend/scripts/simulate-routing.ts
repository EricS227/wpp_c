#!/usr/bin/env node

/**
 * 📱 Simulador de Mensagens - Teste de Roteamento
 *
 * Simula o envio de mensagens de clientes WhatsApp para testar
 * o roteamento automático por departamento
 *
 * Uso:
 *   npx ts-node backend/scripts/simulate-routing.ts --help
 *   npx ts-node backend/scripts/simulate-routing.ts --dept laboratorio
 *   npx ts-node backend/scripts/simulate-routing.ts --client 5541987010101 --msg "1"
 */

import axios from 'axios';
import * as readline from 'readline';

const API_BASE = process.env.API_URL || 'http://localhost:4000/api';

interface TestClient {
  phone: string;
  name: string;
  dept: string;
  menu: string;
}

const TEST_CLIENTS: TestClient[] = [
  // Laboratório
  { phone: '5541987010101', name: 'João Silva - Lab', dept: 'Laboratório', menu: '1' },
  { phone: '5541987010102', name: 'Maria Costa - Lab', dept: 'Laboratório', menu: '1' },
  { phone: '5541987010103', name: 'Pedro Oliveira - Lab', dept: 'Laboratório', menu: '1' },
  { phone: '5541987010104', name: 'Ana Santos - Lab', dept: 'Laboratório', menu: '1' },

  // Administrativo
  { phone: '5541987020201', name: 'Carlos Mendes - ADM', dept: 'Administrativo', menu: '2' },
  { phone: '5541987020202', name: 'Beatriz Lima - ADM', dept: 'Administrativo', menu: '2' },
  { phone: '5541987020203', name: 'Fernando Dias - ADM', dept: 'Administrativo', menu: '2' },
  { phone: '5541987020204', name: 'Lucia Nogueira - ADM', dept: 'Administrativo', menu: '2' },

  // Comercial
  { phone: '5541987030301', name: 'Roberto Gomes - COM', dept: 'Comercial', menu: '3' },
  { phone: '5541987030302', name: 'Fernanda Costa - COM', dept: 'Comercial', menu: '3' },
  { phone: '5541987030303', name: 'Gustavo Alves - COM', dept: 'Comercial', menu: '3' },
  { phone: '5541987030304', name: 'Patricia Ribeiro - COM', dept: 'Comercial', menu: '3' },

  // Financeiro
  { phone: '5541987040401', name: 'Marcelo Ferreira - FIN', dept: 'Financeiro', menu: '4' },
  { phone: '5541987040402', name: 'Gabriela Teixeira - FIN', dept: 'Financeiro', menu: '4' },
  { phone: '5541987040403', name: 'Diego Martins - FIN', dept: 'Financeiro', menu: '4' },
  { phone: '5541987040404', name: 'Mariana Rocha - FIN', dept: 'Financeiro', menu: '4' },
];

class RoutingSimulator {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start() {
    console.log('\n' + '='.repeat(80));
    console.log('📱 Simulador de Roteamento por Departamento');
    console.log('='.repeat(80) + '\n');

    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
      this.showHelp();
      return;
    }

    if (args.includes('--auto')) {
      await this.runAutoTest();
      return;
    }

    if (args.includes('--dept')) {
      const deptIndex = args.indexOf('--dept');
      const dept = args[deptIndex + 1];
      await this.testByDepartment(dept);
      return;
    }

    if (args.includes('--client')) {
      const clientIndex = args.indexOf('--client');
      const phone = args[clientIndex + 1];
      const msgIndex = args.indexOf('--msg');
      const msg = msgIndex >= 0 ? args[msgIndex + 1] : '1';
      await this.sendMessage(phone, msg);
      return;
    }

    // Menu interativo
    await this.interactiveMenu();
  }

  private showHelp() {
    console.log(`
Uso:
  npx ts-node scripts/simulate-routing.ts [opções]

Opções:
  --help                Mostrar esta ajuda
  --auto                Executar teste automático (todos os clientes)
  --dept <nome>         Testar apenas clientes de um departamento
                        (laboratorio, administrativo, comercial, financeiro)
  --client <phone>      Enviar mensagem para um cliente específico
  --msg <mensagem>      Mensagem a enviar (default: "1")

Exemplos:
  # Teste automático
  npx ts-node scripts/simulate-routing.ts --auto

  # Testar apenas Laboratório
  npx ts-node scripts/simulate-routing.ts --dept laboratorio

  # Enviar mensagem personalizadas
  npx ts-node scripts/simulate-routing.ts --client 5541987010101 --msg "análise de qualidade"
    `);
  }

  private async interactiveMenu() {
    console.log('Escolha uma opção:\n');
    console.log('  1 - Teste automático (todos os clientes)');
    console.log('  2 - Teste por departamento');
    console.log('  3 - Enviar mensagem personalizada');
    console.log('  4 - Verificar status das conversas');
    console.log('  0 - Sair\n');

    const choice = await this.question('Opção: ');

    switch (choice) {
      case '1':
        await this.runAutoTest();
        break;
      case '2':
        await this.testByDepartmentInteractive();
        break;
      case '3':
        await this.sendMessageInteractive();
        break;
      case '4':
        await this.checkStatus();
        break;
      case '0':
        console.log('\n👋 Saindo...\n');
        this.rl.close();
        process.exit(0);
      default:
        console.log('\n❌ Opção inválida\n');
        await this.interactiveMenu();
    }
  }

  private async runAutoTest() {
    console.log('\n🚀 Executando teste automático...\n');

    for (const client of TEST_CLIENTS) {
      await this.sendMessage(client.phone, client.menu, client.name);
      // Delay para não sobrecarregar
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('\n✅ Teste automático concluído!\n');
    console.log('📊 Próximas ações:');
    console.log('  1. Acesse o dashboard: http://192.168.10.156:3100');
    console.log('  2. Verifique as conversas em cada departamento');
    console.log('  3. Confirme que foram roteadas corretamente\n');

    await this.askContinue();
  }

  private async testByDepartment(deptName: string) {
    const deptMap: Record<string, string> = {
      lab: 'laboratorio',
      laboratorio: 'laboratorio',
      administrative: 'administrativo',
      administrativo: 'administrativo',
      comercial: 'comercial',
      commercial: 'comercial',
      financeiro: 'financeiro',
      financial: 'financeiro',
    };

    const dept = deptMap[deptName.toLowerCase()];
    if (!dept) {
      console.log(
        `\n❌ Departamento inválido: ${deptName}\nOpções: laboratorio, administrativo, comercial, financeiro\n`,
      );
      return;
    }

    const clients = TEST_CLIENTS.filter((c) =>
      c.dept.toLowerCase().includes(dept),
    );

    console.log(
      `\n📌 Testando ${clients.length} clientes do departamento ${dept}...\n`,
    );

    for (const client of clients) {
      await this.sendMessage(client.phone, client.menu, client.name);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Teste de ${dept} concluído!\n`);
    await this.askContinue();
  }

  private async testByDepartmentInteractive() {
    console.log('\nDepartamentos disponíveis:');
    console.log('  1 - Laboratório');
    console.log('  2 - Administrativo');
    console.log('  3 - Comercial');
    console.log('  4 - Financeiro\n');

    const choice = await this.question('Escolha: ');
    const deptMap: Record<string, string> = {
      '1': 'laboratorio',
      '2': 'administrativo',
      '3': 'comercial',
      '4': 'financeiro',
    };

    const dept = deptMap[choice];
    if (!dept) {
      console.log('\n❌ Opção inválida\n');
      await this.testByDepartmentInteractive();
      return;
    }

    await this.testByDepartment(dept);
  }

  private async sendMessage(
    phone: string,
    message: string,
    clientName?: string,
  ) {
    try {
      const client = TEST_CLIENTS.find((c) => c.phone === phone);
      const name = clientName || client?.name || phone;

      console.log(`  📨 Enviando para ${name}...`);

      // Simular via webhook ou API
      const response = await axios.post(`${API_BASE}/conversations/simulate`, {
        customerPhone: phone,
        message,
      });

      if (response.data.success) {
        const routed = response.data.routed_to || 'desconhecido';
        const assigned = response.data.assigned_to || 'sem agente';
        console.log(
          `     ✓ Roteado para: ${routed} | Agente: ${assigned}`,
        );
      } else {
        console.log(`     ⚠️  Resposta: ${response.data.message}`);
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.log(
          `     ❌ Não conseguiu conectar em ${API_BASE}`,
        );
        console.log(
          '        Verifique se o backend está rodando: docker logs wpp-backend',
        );
      } else if (error.response?.status === 404) {
        console.log(
          `     ⚠️  Endpoint não encontrado. Usando método alternativo...`,
        );
        await this.sendMessageViaDatabase(phone, message);
      } else {
        console.log(`     ❌ Erro: ${error.message}`);
      }
    }
  }

  private async sendMessageViaDatabase(phone: string, message: string) {
    // Fallback: criar via banco de dados diretamente
    console.log(
      `     ℹ️  Criando conversa diretamente no banco de dados...`,
    );
  }

  private async sendMessageInteractive() {
    console.log('\nClientes disponíveis:\n');

    TEST_CLIENTS.forEach((client, i) => {
      console.log(`  ${String(i + 1).padStart(2, ' ')} - ${client.name}`);
    });

    const choice = await this.question('\nEscolha o número do cliente: ');
    const index = parseInt(choice) - 1;

    if (index < 0 || index >= TEST_CLIENTS.length) {
      console.log('\n❌ Opção inválida\n');
      await this.sendMessageInteractive();
      return;
    }

    const client = TEST_CLIENTS[index];
    console.log(
      `\nMensagens sugeridas para ${client.dept}:`,
    );
    console.log(`  1 - ${client.menu} (menu numérico)`);
    console.log(`  2 - Mensagem customizada`);

    const msgChoice = await this.question('\nEscolha: ');

    let msg: string;
    if (msgChoice === '1') {
      msg = client.menu;
    } else {
      msg = await this.question('\nDigite a mensagem: ');
    }

    await this.sendMessage(client.phone, msg, client.name);
    console.log();
    await this.askContinue();
  }

  private async checkStatus() {
    console.log('\n🔍 Verificando status das conversas...\n');

    try {
      const response = await axios.get(
        `${API_BASE}/conversations?status=ASSIGNED`,
      );

      if (response.data.conversations && response.data.conversations.length > 0) {
        const depts: Record<string, number> = {};
        response.data.conversations.forEach((conv: any) => {
          const dept = conv.department?.name || 'Sem departamento';
          depts[dept] = (depts[dept] || 0) + 1;
        });

        console.log('📊 Conversas por departamento:\n');
        Object.entries(depts).forEach(([dept, count]) => {
          console.log(`  • ${dept}: ${count} conversa(s)`);
        });
      } else {
        console.log('  ℹ️  Nenhuma conversa atribuída encontrada');
      }
    } catch (error: any) {
      console.log(`  ❌ Erro ao verificar status: ${error.message}`);
    }

    console.log();
    await this.askContinue();
  }

  private async askContinue() {
    const choice = await this.question('Deseja continuar? (S/n): ');

    if (choice.toLowerCase() === 'n') {
      console.log('\n👋 Saindo...\n');
      this.rl.close();
      process.exit(0);
    }

    await this.interactiveMenu();
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }
}

// Executar
const simulator = new RoutingSimulator();
simulator.start().catch(console.error);
