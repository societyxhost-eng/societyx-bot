const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { logAction } = require("../utils/logger");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("punirmenu")
        .setDescription("Aplica punições a um usuário (ban, kick, timeout, warn) através de menu")
        .addStringOption(option =>
            option
                .setName("tipo")                                                                        
                .setDescription("Tipo de punição")
                .setRequired(true)
                .addChoices(
                    { name: "Banir", value: "ban" },
                    { name: "Expulsar (Kick)", value: "kick" },
                    { name: "Timeout (silenciar temporariamente)", value: "timeout" },
                    { name: "Aviso (Warn)", value: "warn" }
                )
        )
        .addUserOption(option =>
            option
                .setName("usuário")
                .setDescription("Usuário que você deseja punir")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("tempo")
                .setDescription("Tempo da punição (ex: 30M, 1D) — apenas para timeout")
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("motivo")
                .setDescription("Motivo da punição")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const tipo = interaction.options.getString("tipo");
        const user = interaction.options.getUser("usuário");
        const reason = interaction.options.getString("motivo") || "Não informado";
        const tempo = interaction.options.getString("tempo");
        const moderator = interaction.user;

        let member;
        try {
            member = await interaction.guild.members.fetch(user.id);
        } catch {
            return interaction.reply({ content: "❌ Usuário não encontrado no servidor.", ephemeral: true });
        }

        try {
            switch (tipo) {
                case "ban":
                    if (!member.bannable) {
                        return interaction.reply({ content: `❌ Não posso banir ${user.tag}.`, ephemeral: true });
                    }
                    await member.ban({ reason });
                    await interaction.reply(`✅ ${user.tag} foi **banido**. Motivo: ${reason}`);
                    await logAction(interaction.client, {
                        action: "Banimento",
                        moderator,
                        target: user,
                        reason,
                    });
                    break;

                case "kick":
                    if (!member.kickable) {
                        return interaction.reply({ content: `❌ Não posso expulsar ${user.tag}.`, ephemeral: true });
                    }
                    await member.kick(reason);
                    await interaction.reply(`✅ ${user.tag} foi **expulso**. Motivo: ${reason}`);
                    await logAction(interaction.client, {
                        action: "Expulsão (Kick)",
                        moderator,
                        target: user,
                        reason,
                    });
                    break;

                case "timeout":
                    if (!tempo) {
                        return interaction.reply({ content: "❌ Você precisa informar o tempo do timeout (ex: 10M, 1D).", ephemeral: true });
                    }

                    const match = tempo.toUpperCase().match(/^(\d+)([MD])$/);
                    if (!match) {
                        return interaction.reply({ content: "❌ Formato de tempo inválido! Use `30M` ou `1D`.", ephemeral: true });
                    }

                    const valor = parseInt(match[1]);
                    const unidade = match[2];
                    const duration = unidade === "M" ? valor * 60 * 1000 : valor * 24 * 60 * 60 * 1000;

                    if (duration > 28 * 24 * 60 * 60 * 1000) {
                        return interaction.reply({ content: "❌ Tempo máximo permitido é 28D.", ephemeral: true });
                    }

                    await member.timeout(duration, reason);
                    await interaction.reply(`✅ ${user.tag} foi **silenciado por ${tempo}**. Motivo: ${reason}`);
                    await logAction(interaction.client, {
                        action: `Timeout (${tempo})`,
                        moderator,
                        target: user,
                        reason,
                    });
                    break;

                case "warn":
                    await interaction.reply(`⚠️ ${user.tag} recebeu um **aviso**. Motivo: ${reason}`);
                    await logAction(interaction.client, {
                        action: "Aviso (Warn)",
                        moderator,
                        target: user,
                        reason,
                    });
                    break;

                default:
                    await interaction.reply({ content: "❌ Tipo de punição inválido.", ephemeral: true });
            }
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: "❌ Ocorreu um erro ao aplicar a punição.",
                ephemeral: true,
            });
        }
    },
};
