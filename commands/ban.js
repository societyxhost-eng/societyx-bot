const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, MessageFlags } = require('discord.js');
const { logAction } = require("../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bane um usuário do servidor')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('ID do usuário que você deseja banir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do banimento')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction, client, targetUser = null, reasonInput = null) {
        const user = targetUser || (interaction.options ? interaction.options.getUser('usuario') : null);
        const reason = reasonInput || (interaction.options ? interaction.options.getString('motivo') : 'Não informado');

        if (!user) {
            const msg = '❌ Usuário não encontrado.';
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
            else await interaction.reply({ content: msg, ephemeral: true });
            return;
        }

        try {
            const member = await interaction.guild.members.fetch(user.id);

            if (!member.bannable) {
                const msg = `❌ Não consigo banir **${user.tag}**.`;
                if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
                else await interaction.reply({ content: msg, ephemeral: true });
                return;
            }

            const dmContainer = new ContainerBuilder()
                .addTextDisplayComponents(td => td.setContent('# 🚫 Banimento'))
                .addSeparatorComponents(separator => separator)
                .addTextDisplayComponents(td => td.setContent(
                    `Você foi **banido permanentemente** do servidor **${interaction.guild.name}**.\n` +
                    `📝 Motivo: ${reason}`
                ));
            await user.send({ components: [dmContainer], flags: [MessageFlags.IsComponentsV2] }).catch(() => {});

            await member.ban({ reason });

            const successMsg = `✅ **${user.tag}** foi banido com sucesso.`;
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: successMsg });
            else await interaction.reply({ content: successMsg, ephemeral: true });

            await logAction(client, {
                action: "Banimento",
                moderator: interaction.user,
                target: user,
                reason,
                extra: "Ban permanente"
            });

        } catch (err) {
            console.error(err);
            const errorMsg = '❌ Ocorreu um erro ao tentar banir esse usuário.';
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: errorMsg });
            else await interaction.reply({ content: errorMsg, ephemeral: true });
        }
    }
};
