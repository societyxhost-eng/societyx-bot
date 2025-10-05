const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags, 
    ComponentType,
    PermissionFlagsBits
} = require('discord.js');
const warningSystem = require('../utils/warningSystem');

// Função para construir o painel principal do tutorial
function buildTutorialContainer() {
    return new ContainerBuilder()
        .addTextDisplayComponents(text =>
            text.setContent(`# <:Book:1411769115898806344> Painel - Sistema de Warnings\n<:Bot:1411366172560986273> **Aprenda a usar o sistema de warnings do servidor**`)
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent(`## <:Book:1411769115898806344> **Comandos Disponíveis:**\n\n**<:ActionWarning:1411491698382602300> /warn** - Adiciona um warning a um usuário\n**<:lapis:1411786271365533778> /unwarn** - Remove um warning específico\n**<:Clipboard:1411785262190825672> /warnings** - Visualiza warnings (servidor/limpar warnings)\n**<:Search:1411785444856959047> /checkwarn** - Verifica rapidamente warnings de um usuário`)
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent(`## <:ActionWarning:1411491698382602300> **Sistema de Punições:**\n\n<:Warning3:1411784381747691560> **0-1 Warning:** Status normal\n<:Warning2:1411784345106120725> **2 Warnings:** Status de atenção\n<:Warning1:1411784319201972335> **3+ Warnings:** Status crítico\n\n<:ActionQuestion:1411491772164608020> **Dica:** Warnings são permanentes até serem removidos manualmente.`)
        )
        .addSeparatorComponents(separator => separator)
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('view_server_warnings')
                    .setLabel('Ver Warnings do Servidor')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('<:Book:1411769115898806344>'),

                new ButtonBuilder()
                    .setCustomId('view_critical_users')
                    .setLabel('Usuários Críticos')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('<:ActionWarning:1411491698382602300>'),

                new ButtonBuilder()
                    .setCustomId('warning_stats')
                    .setLabel('Estatísticas')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('<:stats:1411787160666898442>'),

                new ButtonBuilder()
                    .setCustomId('refresh_tutorial')
                    .setLabel('Atualizar')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<:Refresh:1411787393752895599>')
            )
        );
}

// Função para construir o painel de warnings do servidor
function buildServerWarningsContainer(guildId) {
    const allWarnings = warningSystem.getAllWarnings(guildId);
    const userWarnings = {};
    
    // Agrupa warnings por usuário
    Object.values(allWarnings).forEach(userWarningList => {
        userWarningList.forEach(warning => {
            if (!userWarnings[warning.userId]) {
                userWarnings[warning.userId] = [];
            }
            userWarnings[warning.userId].push(warning);
        });
    });

    let warningsContent = '';
    if (Object.keys(userWarnings).length === 0) {
        warningsContent = '<:ActionCheck:1411491648516522104> **Nenhum warning ativo no servidor!**\n\n<:shiny:1411788417766920374> Parabéns! Todos os usuários estão com comportamento exemplar.';
    } else {
        warningsContent = '<:Book:1411769115898806344> **Warnings Ativos no Servidor:**\n\n';
        
        // Ordena usuários por quantidade de warnings (decrescente)
        const sortedUsers = Object.entries(userWarnings)
            .sort(([,a], [,b]) => b.length - a.length)
            .slice(0, 10); // Mostra apenas os 10 primeiros

        sortedUsers.forEach(([userId, warnings]) => {
            const warningCount = warnings.length;
            let statusEmoji = '<:Warning3:1411784381747691560>';
            if (warningCount >= 3) statusEmoji = '<:Warning1:1411784319201972335>';
            else if (warningCount >= 2) statusEmoji = '<:Warning2:1411784345106120725>';
            
            warningsContent += `${statusEmoji} <@${userId}> - **${warningCount}** warning${warningCount > 1 ? 's' : ''}\n`;
        });
        
        if (Object.keys(userWarnings).length > 10) {
            warningsContent += `\n... e mais ${Object.keys(userWarnings).length - 10} usuários`;
        }
    }

    return new ContainerBuilder()
        .addTextDisplayComponents(text =>
            text.setContent(`# <:Book:1411769115898806344> Warnings do Servidor\n<:File:1411788987353272320> **Visão geral de todos os warnings ativos**`)
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent(warningsContent)
        )
        .addSeparatorComponents(separator => separator)
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_tutorial')
                    .setLabel('Voltar')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('<:ArrowLeft:1411789130664251535>'),

                new ButtonBuilder()
                    .setCustomId('refresh_server_warnings')
                    .setLabel('Atualizar')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<:Refresh:1411787393752895599>')
            )
        );
}

// Função para construir o painel de usuários críticos
function buildCriticalUsersContainer(guildId) {
    const allWarnings = warningSystem.getAllWarnings(guildId);
    const criticalUsers = [];
    
    Object.entries(allWarnings).forEach(([userId, warnings]) => {
        if (warnings.length >= 2) {
            criticalUsers.push({ userId, warnings });
        }
    });

    let criticalContent = '';
    if (criticalUsers.length === 0) {
        criticalContent = '<:ActionCheck:1411491648516522104> **Nenhum usuário em situação crítica!**\n\n<:shiny:1411788417766920374> Todos os usuários estão com 0-1 warnings.';
    } else {
        criticalContent = '<:ActionWarning:1411491698382602300> **Usuários em Situação Crítica:**\n\n';
        
        criticalUsers
            .sort((a, b) => b.warnings.length - a.warnings.length)
            .forEach(({ userId, warnings }) => {
                const warningCount = warnings.length;
                const statusEmoji = warningCount >= 3 ? '<:Warning1:1411784319201972335>' : '<:Warning2:1411784345106120725>';
                const status = warningCount >= 3 ? 'CRÍTICO' : 'ATENÇÃO';
                
                const lastWarning = warnings[warnings.length - 1];
                const lastDate = new Date(lastWarning.timestamp).toLocaleDateString('pt-BR');
                
                criticalContent += `${statusEmoji} **${status}** - <@${userId}>\n`;
                criticalContent += `   <:Book:1411769115898806344> **${warningCount}** warnings | <:Calendar:1411770124192579676> Último: ${lastDate}\n`;
                criticalContent += `   <:Clipboard:1411785262190825672> "${lastWarning.reason.substring(0, 40)}${lastWarning.reason.length > 40 ? '...' : ''}"\n\n`;
            });
    }

    return new ContainerBuilder()
        .addTextDisplayComponents(text =>
            text.setContent(`# <:ActionWarning:1411491698382602300> Usuários Críticos\n<:lapis:1411786271365533778> **Usuários com 2+ warnings que precisam de atenção**`)
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent(criticalContent)
        )
        .addSeparatorComponents(separator => separator)
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_tutorial')
                    .setLabel('Voltar ao Tutorial')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('<:ArrowLeft:1411789130664251535>'),

                new ButtonBuilder()
                    .setCustomId('refresh_critical_users')
                    .setLabel('Atualizar')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<:Refresh:1411787393752895599>')
            )
        );
}

// Função para construir o painel de estatísticas
function buildStatsContainer(guildId) {
    const allWarnings = warningSystem.getAllWarnings(guildId);
    
    let totalWarnings = 0;
    let totalUsers = 0;
    let criticalUsers = 0;
    let attentionUsers = 0;
    let cleanUsers = 0;
    
    Object.values(allWarnings).forEach(warnings => {
        totalWarnings += warnings.length;
        totalUsers++;
        
        if (warnings.length >= 3) criticalUsers++;
        else if (warnings.length >= 2) attentionUsers++;
        else cleanUsers++;
    });
    
    const avgWarnings = totalUsers > 0 ? (totalWarnings / totalUsers).toFixed(1) : 0;
    
    const statsContent = `<:stats:1411787160666898442> **Estatísticas do Servidor:**\n\n` +
        `<:Clipboard:1411785262190825672> **Total de warnings:** ${totalWarnings}\n` +
        `<:UserUsers:1411792760054222858> **Usuários com warnings:** ${totalUsers}\n` +
        `<:Clipboard:1411785262190825672> **Média por usuário:** ${avgWarnings}\n\n` +
        `<:Warning1:1411784319201972335> **Usuários críticos (3+):** ${criticalUsers}\n` +
        `<:Warning2:1411784345106120725> **Usuários em atenção (2):** ${attentionUsers}\n` +
        `<:Warning3:1411784381747691560> **Usuários normais (0-1):** ${cleanUsers}\n\n` +
        `<:Calendar:1411770124192579676> **Última atualização:** <t:${Math.floor(Date.now() / 1000)}:R>`;

    return new ContainerBuilder()
        .addTextDisplayComponents(text =>
            text.setContent(`# <:stats:1411787160666898442> Estatísticas de Warnings\n<:Clipboard:1411785262190825672> **Dados gerais do sistema de warnings**`)
        )
        .addSeparatorComponents(separator => separator)
        .addTextDisplayComponents(text =>
            text.setContent(statsContent)
        )
        .addSeparatorComponents(separator => separator)
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_tutorial')
                    .setLabel('Voltar ao Tutorial')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('<:ArrowLeft:1411789130664251535>'),

                new ButtonBuilder()
                    .setCustomId('refresh_stats')
                    .setLabel('Atualizar')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<:Refresh:1411787393752895599>')
            )
        );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel')
        .setDescription('Painel interativo do sistema de warnings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const response = await interaction.reply({
            components: [buildTutorialContainer()],
            flags: MessageFlags.IsComponentsV2,
            withResponse: true
        });

        const message = response.resource.message;
        const collector = message.createMessageComponentCollector({ 
            componentType: ComponentType.Button,
            time: 300000 // 5 minutos
        });

        collector.on('collect', async i => {
            const guildId = interaction.guild.id;

            try {
                switch (i.customId) {
                    case 'view_server_warnings':
                        await i.update({
                            components: [buildServerWarningsContainer(guildId)],
                            flags: MessageFlags.IsComponentsV2
                        });
                        break;

                    case 'view_critical_users':
                        await i.update({
                            components: [buildCriticalUsersContainer(guildId)],
                            flags: MessageFlags.IsComponentsV2
                        });
                        break;

                    case 'warning_stats':
                        await i.update({
                            components: [buildStatsContainer(guildId)],
                            flags: MessageFlags.IsComponentsV2
                        });
                        break;

                    case 'refresh_tutorial':
                    case 'back_to_tutorial':
                        await i.update({
                            components: [buildTutorialContainer()],
                            flags: MessageFlags.IsComponentsV2
                        });
                        break;

                    case 'refresh_server_warnings':
                        await i.update({
                            components: [buildServerWarningsContainer(guildId)],
                            flags: MessageFlags.IsComponentsV2
                        });
                        break;

                    case 'refresh_critical_users':
                        await i.update({
                            components: [buildCriticalUsersContainer(guildId)],
                            flags: MessageFlags.IsComponentsV2
                        });
                        break;

                    case 'refresh_stats':
                        await i.update({
                            components: [buildStatsContainer(guildId)],
                            flags: MessageFlags.IsComponentsV2
                        });
                        break;
                }
            } catch (error) {
                console.error('Erro no tutorial de warnings:', error);
                await i.reply({
                    content: '❌ Ocorreu um erro ao processar sua solicitação.',
                    ephemeral: true
                });
            }
        });

        collector.on('end', async () => {
            try {
                await message.edit({
                    components: [buildTutorialContainer().addTextDisplayComponents(text =>
                        text.setContent('<:Clock:1411792992980697158> **Sessão expirada.** Use `/tutorial` novamente para reativar o painel.')
                    )]
                });
            } catch (error) {
                console.error('Erro ao finalizar collector:', error);
            }
        });
    }
};
