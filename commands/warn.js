const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} = require('discord.js');
const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Aplica um warning a um usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário que receberá o warning')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do warning')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const motivo = interaction.options.getString('motivo') || 'Sem motivo';
        const guildId = interaction.guild.id;

        if (!user) return interaction.reply({ content: 'Usuário não encontrado.', flags: [MessageFlags.Ephemeral] });

        const totalWarnings = warningSystem.addWarning(guildId, user.id, motivo);

        // Envia mensagem privada para o usuário
        const container = new ContainerBuilder()
            .addTextDisplayComponents(textDisplay =>
                textDisplay.setContent(`# <:ActionWarning:1411491698382602300> Aviso!`)
            )
            .addSeparatorComponents(separator => separator)
            .addTextDisplayComponents(textDisplay =>
                textDisplay.setContent(`<:exclamation:1411845344396054639>Você recebeu um warning no servidor **${interaction.guild.name}**.\n<:board:1411842629557289060>Motivo: ${motivo}\n<:fileSearch:1411844237154058260>Total de warnings: ${totalWarnings}`)
            );

        user.send({ components: [container], flags: [MessageFlags.IsComponentsV2] }).catch(() => {});

        await interaction.reply({ content: `Warning aplicado para ${user.tag} com sucesso!`, flags: [MessageFlags.Ephemeral] });

        logAction(interaction.client, {
            action: 'Warn',
            moderator: interaction.user,
            target: user,
            reason: motivo
        });
    }
};
