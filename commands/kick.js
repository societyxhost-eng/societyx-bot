const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction } = require('../utils/logger');
const { toast, EPHEMERAL_FLAG } = require('../utils/toast');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa um usuário do servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('ID do usuário que você deseja expulsar')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Motivo da expulsão')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction, client, targetUser = null, reasonInput = null) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: EPHEMERAL_FLAG });
      }
    } catch {}

    const user = targetUser || (interaction.options ? interaction.options.getUser('usuario') : null);
    const reason = (reasonInput ?? (interaction.options ? interaction.options.getString('motivo') : null) ?? '').trim() || 'Sem motivo';

    if (!user) {
      await toast(interaction, '❌ Usuário não encontrado.');
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await toast(interaction, '❌ Usuário não está mais no servidor.');
        return;
      }

      if (!member.kickable) {
        await toast(interaction, `❌ Não consigo expulsar ${user.tag}. Verifique hierarquia/permissões.`);
        return;
      }

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('👢 Expulsão de Moderação')
          .setDescription(`Você foi **expulso** do servidor **${interaction.guild.name}**.`)
          .setColor('#F1C40F')
          .addFields(
            { name: '📝 Motivo', value: reason },
            { name: '👮‍♂️ Moderador', value: interaction.user.tag }
          )
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch {}

      await member.kick(`Por: ${interaction.user.tag} • Motivo: ${reason}`);

      await logAction(client, {
        action: 'Kick',
        moderator: interaction.user,
        target: user,
        reason,
        extra: `Usuário expulso do servidor ${interaction.guild.name}`,
      });

      await toast(interaction, `✅ ${user.tag} foi expulso(a).\n📝 Motivo: ${reason}`);

    } catch (err) {
      console.error('[KICK] Erro ao expulsar:', err);
      await toast(interaction, '❌ Ocorreu um erro ao tentar expulsar esse usuário.');
    }
  }
};