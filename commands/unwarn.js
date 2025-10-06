const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Remove um warning específico de um usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário que terá o warning removido')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('indice')
                .setDescription('Índice do warning a ser removido (começa em 1)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const guildId = interaction.guild.id;
        const indice = interaction.options.getInteger('indice');

        if (!user) return interaction.reply({ content: 'Usuário não encontrado.', flags: [MessageFlags.Ephemeral] });

        const warnings = warningSystem.getAllWarnings(guildId)[user.id] || [];
        if (warnings.length === 0) return interaction.reply({ content: 'Este usuário não possui warnings.', flags: [MessageFlags.Ephemeral] });

        let removedWarning;
        if (indice) {
            if (indice < 1 || indice > warnings.length) {
                return interaction.reply({ content: 'Índice inválido.', flags: [MessageFlags.Ephemeral] });
            }
            removedWarning = warnings.splice(indice - 1, 1)[0];
        } else {
            removedWarning = warnings.pop(); 
        }

        const allWarnings = warningSystem.getAllWarnings(guildId);
        allWarnings[user.id] = warnings;
        warningSystem.saveWarnings(allWarnings);

        await interaction.reply({ content: `Warning removido de ${user.tag} com sucesso!`, flags: [MessageFlags.Ephemeral] });

        logAction(interaction.client, {
            action: 'Unwarn',
            moderator: interaction.user,
            target: user,
            reason: removedWarning?.reason || 'Sem motivo'
        });
    }
};
