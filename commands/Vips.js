const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');

function criarTelaInicialVip() {
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vip_inicial').setLabel('Inicial').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vip_advanced').setLabel('Advanced').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vip_pro').setLabel('Pro').setStyle(ButtonStyle.Primary)
  );

  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## VIPs disponíveis'))
    .addActionRowComponents(buttonRow);
}

function criarTelaVipPlano(nome, descricao, comprarId) {
  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('voltar_vips').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
  );

  if (comprarId) {
    backRow.addComponents(
      new ButtonBuilder().setCustomId(comprarId).setLabel('Comprar').setStyle(ButtonStyle.Primary)
    );
  }

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## VIP ${nome}`),
      new TextDisplayBuilder().setContent(descricao)
    )
    .addActionRowComponents(backRow);
}

function criarTelaCompraVip(nome) {
  const tempoRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('Um_mes').setLabel('1 Mês').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('Dois_mes').setLabel('2 Meses').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('Tres_mes').setLabel('3 Meses').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('voltar_vips').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
  );

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Compra do VIP ${nome}`),
      new TextDisplayBuilder().setContent('Selecione a duração do seu VIP:')
    )
    .addActionRowComponents(tempoRow);
}

function criarTelaPagamentoVip(periodo) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Pagamento - ${periodo}`),
      new TextDisplayBuilder().setContent('Entre em contato com um administrador para finalizar seu pagamento.')
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('voltar_vips').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
      )
    );
}

async function handleButton(interaction) {
  if (!interaction.isButton()) return;

  let container;

  switch (interaction.customId) {
    case 'vip_inicial':
      container = criarTelaVipPlano(
        'Inicial',
        '> Recursos básicos para começar.\n> Acesso a canais VIP iniciais.\n> Suporte prioritário nível 1.',
        'comprar_inicial'
      );
      break;

    case 'vip_advanced':
      container = criarTelaVipPlano(
        'Advanced',
        '> Inclui tudo do Inicial e mais.\n> Acesso a mais canais VIP.\n> Permissões extras e benefícios mensais.\n> Suporte prioritário nível 2.',
        'comprar_advanced'
      );
      break;

    case 'vip_pro':
      container = criarTelaVipPlano(
        'Pro',
        '> Pacote completo com vantagens premium.\n> Acesso total aos canais VIP.\n> Benefícios exclusivos e prioridade máxima no suporte.',
        'comprar_pro'
      );
      break;

    case 'voltar_vips':
      container = criarTelaInicialVip();
      break;

    case 'comprar_inicial':
      container = criarTelaCompraVip('Inicial');
      break;
    case 'comprar_advanced':
      container = criarTelaCompraVip('Advanced');
      break;
    case 'comprar_pro':
      container = criarTelaCompraVip('Pro');
      break;

    case 'Um_mes':
      container = criarTelaPagamentoVip('1 Mês');
      break;
    case 'Dois_mes':
      container = criarTelaPagamentoVip('2 Meses');
      break;
    case 'Tres_mes':
      container = criarTelaPagamentoVip('3 Meses');
      break;

    default:
      return;
  }

  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vips')
    .setDescription('Abrir o menu de VIPs (Inicial, Advanced, Pro).'),
  async execute(interaction) {
    const container = criarTelaInicialVip();
    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
  handleButton,
};