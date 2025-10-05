const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require("../utils/logger");


module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bane um usuário do servidor')
        .addUserOption(option =>
            option.setName('usuário')
                .setDescription('Usuário que você deseja banir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do banimento')
                .setRequired(false))
        // Apenas quem tem permissão de ban pode usar o comando
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const user = interaction.options.getUser('usuário');
        const reason = interaction.options.getString('motivo') || 'Não informado';

        try {
            const member = await interaction.guild.members.fetch(user.id);

            // Verifica se o bot tem permissão
            if (!member.bannable) {
                return await interaction.reply({
                    content: `❌ Não consigo banir **${user.tag}**.`,
                    ephemeral: true
                });
            }

            await member.ban({ reason });
            await interaction.reply(`✅ **${user.tag}** foi banido. Motivo: ${reason}`);

            logAction(interaction.client, {
                action: "Banimento",
                moderator: interaction.user,
                target: user,
                reason
            });

        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: '❌ Ocorreu um erro ao tentar banir esse usuário.',
                ephemeral: true
            });
        }
    }
};