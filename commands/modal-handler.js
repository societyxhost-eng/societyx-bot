const { resolveUser } = require('../utils/resolveUser');
const warnCommand = require('../commands/warn');
const kickCommand = require('../commands/kick');
const banCommand = require('../commands/ban');
const punirCommand = require('../commands/punir');
const { toast, EPHEMERAL_FLAG } = require('../utils/toast');

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

    let userInput = '';
    let reasonInput = 'Sem motivo';
    let durationInput = null;

    try { userInput = interaction.fields.getTextInputValue('target_user')?.trim(); } catch {}
    try { reasonInput = (interaction.fields.getTextInputValue('reason') || 'Sem motivo').trim(); } catch {}
    try { durationInput = interaction.fields.getTextInputValue('duration')?.trim() || null; } catch {}

    let targetUser = null;
    try {
      targetUser = await resolveUser(interaction.guild, userInput);
    } catch {}

    if (!targetUser) {
      await toast(interaction, '❌ Usuário não encontrado. Verifique o ID/menção e se está no servidor.');
      return;
    }

    try {
      switch (action) {
        case 'warn':
          await warnCommand.execute(interaction, client, targetUser, null, reasonInput);
          return;

        case 'kick':
          await kickCommand.execute(interaction, client, targetUser, reasonInput);
          return;

        case 'ban':
          await banCommand.execute(interaction, client, targetUser, reasonInput);
          return;

        case 'punir':
          await punirCommand.execute(interaction, client, targetUser, durationInput, reasonInput);
          return;

        default:
          await toast(interaction, '❌ Ação inválida.');
          return;
      }
    } catch (err) {
      console.error(`Erro ao executar a ação '${action}':`, err);
      await toast(interaction, '❌ Ocorreu um erro ao executar a ação.');
    }
  });
};