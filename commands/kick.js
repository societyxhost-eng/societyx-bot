const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, MessageFlags } = require('discord.js');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa um usuário do servidor')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('ID do usuário que você deseja expulsar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da expulsão')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

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

            if (!member.kickable) {
                const msg = `❌ Não consigo expulsar **${user.tag}**.`;
                if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
                else await interaction.reply({ content: msg, ephemeral: true });
                return;
            }

            const container = new ContainerBuilder()
                .addTextDisplayComponents(td => td.setContent(`# 👢 Expulsão`))
                .addSeparatorComponents(separator => separator)
                .addTextDisplayComponents(td => td.setContent(
                    `Você foi **expulso** do servidor **${interaction.guild.name}**.\n` +
                    `📝 Motivo: ${reason}`
                ));

            await user.send({ components: [container], flags: [MessageFlags.IsComponentsV2] }).catch(() => {});

            await member.kick(reason);

            const successMsg = `✅ **${user.tag}** foi expulso.`;
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: successMsg });
            else await interaction.reply({ content: successMsg, ephemeral: true });

            await logAction(client, {
                action: "Expulsão",
                moderator: interaction.user,
                target: user,
                reason,
                extra: `Usuário expulso do servidor ${interaction.guild.name}`
            });

        } catch (err) {
            console.error(err);
            const errorMsg = '❌ Ocorreu um erro ao tentar expulsar esse usuário.';
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: errorMsg });
            else await interaction.reply({ content: errorMsg, ephemeral: true });
        }
    }
};
