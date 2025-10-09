const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../utils/logger');
const { toast, EPHEMERAL_FLAG } = require('../utils/toast');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Desbane um usuário do servidor')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('ID do usuário que você deseja desbanir')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: EPHEMERAL_FLAG });
      }
    } catch {}

    const userId = interaction.options.getString('id');

    try {
      const bannedUser = await interaction.guild.bans.fetch(userId).catch(() => null);
      if (!bannedUser) {
        await toast(interaction, '❌ Usuário não encontrado na lista de banidos.');
        return;
      }

      await interaction.guild.members.unban(userId);

      await toast(interaction, `✅ ${bannedUser.user.tag} foi desbanido(a).`);

      await logAction(interaction.client, {
        action: 'Unban',
        moderator: interaction.user,
        target: bannedUser.user,
        reason: 'Desbanimento manual via comando',
      });

    } catch (err) {
      console.error('[UNBAN] Erro ao desbanir:', err);
      await toast(interaction, '❌ Ocorreu um erro ao tentar desbanir. Verifique se o ID está correto.');
    }
  }
};