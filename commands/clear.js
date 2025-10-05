const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Limpa mensagens do canal')
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Quantidade de mensagens para deletar (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('quantidade');

        try {
            await interaction.deferReply({ ephemeral: true });

            const deleted = await interaction.channel.bulkDelete(amount, true);

            await interaction.editReply({
                content: `✅ ${deleted.size} mensagens foram deletadas.`
            });

            logAction(interaction.client, {
                action: "Clear",
                moderator: interaction.user,
                target: null,
                reason: `${deleted.size} mensagens deletadas no canal #${interaction.channel.name}`
            });

        } catch (err) {
            console.error(err);
            await interaction.editReply({
                content: '❌ Ocorreu um erro ao tentar deletar as mensagens. Verifique se as mensagens não são muito antigas (mais de 14 dias).'
            });
        }
    }
};