const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bane um usuário do servidor')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuário que você deseja banir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Motivo do banimento')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, client, targetUser = null, reasonInput = null) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const user = targetUser || (interaction.options ? interaction.options.getUser('usuario') : null);
    const rawReasonFromSlash = interaction.options ? interaction.options.getString('motivo') : null;
    const motivo = (reasonInput ?? rawReasonFromSlash ?? '').trim() || 'Motivo não informado.';

    if (!user) {
      return interaction.editReply({ content: '❌ Usuário não encontrado.' });
    }

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      const dmEmbed = new EmbedBuilder()
        .setTitle('🚫 Banimento de Moderação')
        .setDescription(`Você foi **banido permanentemente** do servidor **${interaction.guild.name}**.`)
        .setColor('#E74C3C')
        .addFields(
          { name: '📝 Motivo', value: motivo },
          { name: '👮‍♂️ Moderador', value: interaction.user.tag }
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] }).catch(() => {
        console.log(`Não foi possível enviar DM para o usuário ${user.tag}.`);
      });

      const reasonForAudit = `Por: ${interaction.user.tag} • Motivo: ${motivo}`;
      if (member) {
        if (!member.bannable) {
          return interaction.editReply({
            content: `❌ Não consigo banir **${user.tag}**. Verifique hierarquia/permissões.`
          });
        }
        await member.ban({ reason: reasonForAudit });
      } else {
        await interaction.guild.members.ban(user.id, { reason: reasonForAudit });
      }

      await interaction.editReply({
        content: `✅ ${user.tag} foi banido com sucesso.\n📝 Motivo: ${motivo}`
      });

      await logAction(client, {
        action: 'Ban',
        moderator: interaction.user,
        target: user,
        reason: motivo,
        extra: 'Ban permanente'
      });

    } catch (err) {
      console.error('[BAN] Erro ao banir:', err);
      return interaction.editReply({
        content: '❌ Ocorreu um erro ao tentar banir esse usuário. Verifique permissões/hierarquia.'
      });
    }
  }
};