const { toast, EPHEMERAL_FLAG } = require('../utils/toast');
const { resolveUser } = require('../utils/resolveUser');
const warnCommand = require('../commands/warn');
const kickCommand = require('../commands/kick');
const banCommand = require('../commands/ban');
const punirCommand = require('../commands/punir');
const warningSystem = require('../utils/warningSystem');
const { buildWarningsPanel, panelState } = require('../commands/menu-staff'); 

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('staff_modal_')) return;

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: EPHEMERAL_FLAG });
      }
    } catch {}

    const action = interaction.customId.replace('staff_modal_', '');

if (action === 'filter_warnings') {
  try {
    const filterText = interaction.fields.getTextInputValue('filter_user')?.trim() || '';
    const all = warningSystem.getAllWarnings(interaction.guild.id) || {};

    const filteredUsers = Object.keys(all).filter(id => {
      const member = interaction.guild.members.cache.get(id);
      const label = member?.displayName || member?.user?.tag || id;
      return label.toLowerCase().includes(filterText.toLowerCase()) || id.includes(filterText);
    });

    const panel = await buildWarningsPanel(interaction, 1, filteredUsers);

    await interaction.editReply({ embeds: [panel.embed], components: panel.components });

    panelState.set(interaction.message.id, { 
      state: 'warnings', 
      data: { users: panel.users, page: panel.page, totalPages: panel.totalPages } 
    });

  } catch (err) {
    console.error('Erro ao filtrar avisos:', err);
    await toast(interaction, '❌ Ocorreu um erro ao filtrar.');
  }
  return;
}

    let userInput = '';
    let reasonInput = 'Sem motivo';
    let durationInput = null;

    try { userInput = interaction.fields.getTextInputValue('target_user')?.trim(); } catch {}
    try { reasonInput = (interaction.fields.getTextInputValue('reason') || 'Sem motivo').trim(); } catch {}
    try { durationInput = interaction.fields.getTextInputValue('duration')?.trim() || null; } catch {}

    let targetUser = null;
    try { targetUser = await resolveUser(interaction.guild, userInput); } catch {}

    if (!targetUser) {
      await toast(interaction, '❌ Usuário não encontrado. Verifique o ID/menção e se está no servidor.');
      return;
    }

    try {
      switch (action) {
        case 'warn':
          await warnCommand.execute(interaction, client, targetUser, null, reasonInput);
          break;

        case 'kick':
          await kickCommand.execute(interaction, client, targetUser, reasonInput);
          break;

        case 'ban':
          await banCommand.execute(interaction, client, targetUser, reasonInput);
          break;

        case 'punir':
          await punirCommand.execute(interaction, client, targetUser, durationInput, reasonInput);
          break;

        default:
          await toast(interaction, '❌ Ação inválida.');
      }
    } catch (err) {
      console.error(`Erro ao executar a ação '${action}':`, err);
      await toast(interaction, '❌ Ocorreu um erro ao executar a ação.');
    }
  });
};
