const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, MessageFlags } = require('discord.js');
const { logAction } = require("../utils/logger");

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
    const motivo = (reasonInput ?? rawReasonFromSlash ?? '').trim() || 'Não informado';

    if (!user) {
      const msg = '❌ Usuário não encontrado.';
      return interaction.editReply({ content: msg });
    }

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      try {
        const dmContainer = new ContainerBuilder()
          .addTextDisplayComponents(td => td.setContent('# 🚫 Banimento'))
          .addSeparatorComponents(separator => separator)
          .addTextDisplayComponents(td => td.setContent(
            `Você foi **banido permanentemente** do servidor **${interaction.guild.name}**.\n` +
            `📝 Motivo: ${motivo}`
          ));
        await user.send({ components: [dmContainer], flags: [MessageFlags.IsComponentsV2] }).catch(() => {});
      } catch { }

      if (member) {
        if (!member.bannable) {
          return interaction.editReply({ content: `❌ Não consigo banir **${user.tag}**. Verifique hierarquia/permissões.` });
        }
        await member.ban({ reason: motivo });
      } else {
        await interaction.guild.members.ban(user.id, { reason: motivo });
      }

      await logAction(client, {
        action: "Banimento",
        moderator: interaction.user,
        target: user,
        reason: motivo,
        extra: "Ban permanente"
      });

      const successMsg = `✅ **${user.tag}** foi banido com sucesso.\n📝 Motivo: ${motivo}`;
      return interaction.editReply({ content: successMsg });

    } catch (err) {
      console.error('[BAN] Erro ao banir:', err);
      return interaction.editReply({ content: '❌ Ocorreu um erro ao tentar banir esse usuário. Verifique permissões/hierarquia.' });
    }
  }
};