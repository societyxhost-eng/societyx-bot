const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const warningSystem = require('../utils/warningSystem');
const { logAction } = require('../utils/logger');
const { toast, EPHEMERAL_FLAG } = require('../utils/toast');

const EPHEMERAL_TTL_MS = 8000; 

function parseDuration(input) {
    const regex = /^(\d+)\s*(s|sec|seg|m|min|h|hr|d|mes)$/i;
    const match = input?.match(regex);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 's': case 'sec': case 'seg': return value * 1000;
        case 'm': case 'min': return value * 60 * 1000;
        case 'h': case 'hr': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'mes': return value * 30 * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

const AUTO_PUNISH_RULES = [
    { warns: 7, duration: '7d', reason: 'Acúmulo automático de 7 advertências. Timeout de 7 dias.' },
    { warns: 5, duration: '1d', reason: 'Acúmulo automático de 5 advertências. Timeout de 24 horas.' },
    { warns: 3, duration: '2h', reason: 'Acúmulo automático de 3 advertências. Timeout de 2 horas.' },
];

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

    async execute(interaction, client, targetUser = null, duration = null, reason = null) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: EPHEMERAL_FLAG });
            }
        } catch {}

        const user = targetUser || (interaction.options ? interaction.options.getUser('usuario') : null);
        const motivo = (reason ?? (interaction.options ? interaction.options.getString('motivo') : null) ?? '').trim() || 'Motivo não informado.';

        if (!user) {
            await interaction.editReply('❌ Usuário não encontrado.');
            return;
        }

        const guildId = interaction.guild.id;
        const { warning, totalWarnings } = warningSystem.addWarning(guildId, user.id, motivo);

        const dmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Aviso de Moderação')
            .setDescription(`Você recebeu um **warning** no servidor **${interaction.guild.name}**.`)
            .setColor('#E67E22')
            .addFields(
                { name: '📝 Motivo', value: motivo },
                { name: '📊 Total de Warnings', value: `Agora você possui **${totalWarnings}** warning(s).` },
                { name: '👮‍♂️ Moderador', value: interaction.user.tag }
            )
            .setFooter({ text: `ID do Aviso: ${warning.id}` })
            .setTimestamp();

        await user.send({ embeds: [dmEmbed] }).catch(err => {
            console.log(`[DM INFO] Não foi possível enviar a DM de warning para ${user.tag}. Motivo: ${err.message}`);
        });
        
        await logAction(client, {
            action: 'Warn',
            moderator: interaction.user,
            target: user,
            reason: motivo,
            extra: `Total de Warnings: ${totalWarnings}\nID do Warning: ${warning.id}`
        });
        
        const finalMessage = await checkAndApplyPunishment(interaction, client, user, totalWarnings);
        
        await interaction.editReply(finalMessage);
        
        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, EPHEMERAL_TTL_MS);
    }
};

async function checkAndApplyPunishment(interaction, client, user, totalWarnings) {
    const rule = AUTO_PUNISH_RULES.find(r => totalWarnings >= r.warns);

    if (!rule) {
        return `✅ Warning aplicado para ${user.tag}! Ele(a) agora tem **${totalWarnings}** warning(s).`;
    }

    try {
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member || !member.moderatable) {
            return `✅ Warning aplicado, mas **não foi possível punir automaticamente** ${user.tag} (permissões/hierarquia).`;
        }
        
        const durationMs = parseDuration(rule.duration);
        if(!durationMs) {
             return `✅ Warning aplicado, mas a duração da punição automática é inválida.`;
        }

        console.log(`[DEBUG] Ponto 1: Preparando para enviar DM de punição para ${user.tag}.`);
        try {
            const dmPunishEmbed = new EmbedBuilder()
                .setTitle('⏳ Punição Automática')
                .setDescription(`Você recebeu **timeout** no servidor **${interaction.guild.name}** devido ao acúmulo de advertências.`)
                .setColor('#9B59B6')
                .addFields(
                    { name: '🕐 Duração', value: rule.duration },
                    { name: '📝 Motivo', value: rule.reason },
                    { name: '👮‍♂️ Moderador', value: client.user.tag } 
                )
                .setTimestamp();
            await user.send({ embeds: [dmPunishEmbed] });
            console.log(`[DEBUG] Ponto 2: Tentativa de envio de DM para ${user.tag} CONCLUÍDA SEM ERROS.`);
        } catch (dmError) {
            console.error(`[DEBUG] ERRO AO ENVIAR DM DE PUNIÇÃO para ${user.tag}! Motivo:`, dmError.message);
        }

        await member.timeout(durationMs, rule.reason);

        await logAction(client, {
            action: 'Timeout Automático',
            moderator: client.user,
            target: user,
            reason: rule.reason,
            extra: `Duração: ${rule.duration} | Total de Warnings: ${totalWarnings}`,
        });
        
        return `✅ Warning aplicado! **🚨 PUNIÇÃO AUTOMÁTICA:** ${user.tag} atingiu **${totalWarnings}** warnings e recebeu timeout de **${rule.duration}**.`;

    } catch (error) {
        console.error(`[AutoMod] Falha CRÍTICA ao aplicar punição automática em ${user.tag}:`, error);
        return `✅ Warning aplicado, mas **ocorreu um erro CRÍTICO** ao tentar punir automaticamente ${user.tag}.`;
    }
}