const { resolveUser } = require('../utils/resolveUser');
const warnCommand = require('../commands/warn');
const kickCommand = require('../commands/kick');
const banCommand = require('../commands/ban');
const punirCommand = require('../commands/punir');

const EPHEMERAL_FLAG = 1 << 6;

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('staff_modal_')) return;

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: EPHEMERAL_FLAG });
      }
    } catch (e) {
    }

    const action = interaction.customId.replace('staff_modal_', '');
    const userInput = interaction.fields.getTextInputValue('target_user');
    const reasonInput = (interaction.fields.getTextInputValue('reason') || 'Sem motivo').trim();

    let durationInput = null;
    try {
      durationInput = interaction.fields.getTextInputValue('duration');
    } catch (_) {}

    let targetUser = null;
    try {
      targetUser = await resolveUser(interaction.guild, userInput);
    } catch (_) {}

    if (!targetUser) {
      return interaction.editReply({
        content: '❌ Usuário não encontrado. Verifique o ID/menção e se está no servidor.',
      }).catch(() => {});
    }

    try {
      switch (action) {
        case 'warn':
          await warnCommand.execute(interaction, client, targetUser, null, reasonInput);
          break;
        case 'kick':
          await kickCommand.execute(interaction, client, targetUser, null, reasonInput);
          break;
        case 'ban':
          await banCommand.execute(interaction, client, targetUser, reasonInput);
          break;
        case 'punir':
          await punirCommand.execute(interaction, client, targetUser, durationInput, reasonInput);
          break;
        default:
          await interaction.editReply({ content: '❌ Ação inválida.' });
          return;
      }

      await interaction.editReply({ content: '✅ Ação registrada.' }).catch(() => {});
    } catch (err) {
      console.error(`Erro ao executar a ação '${action}':`, err);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '❌ Ocorreu um erro ao executar a ação.' });
        } else {
          await interaction.reply({ content: '❌ Ocorreu um erro ao executar a ação.', flags: EPHEMERAL_FLAG });
        }
      } catch (_) {}
    }
  });
};