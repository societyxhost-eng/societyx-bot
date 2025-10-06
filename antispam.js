const { Events, ContainerBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

// Map para armazenar mensagens dos usuários
const userMessages = new Map();
const userCooldowns = new Map();

// Configurações do anti-spam
const SPAM_CONFIG = {
    maxMessages: 5,        // Máximo de mensagens
    timeWindow: 5000,      // Janela de tempo em ms (5 segundos)
    duplicateThreshold: 3, // Máximo de mensagens idênticas
    cooldownTime: 30000    // Tempo de cooldown em ms (30 segundos)
};

module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        // Ignorar bots e mensagens de DM
        if (message.author.bot || !message.guild) return;

        // Ignorar usuários com permissão de gerenciar mensagens
        if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        const userId = message.author.id;
        const currentTime = Date.now();

        // Verificar se o usuário está em cooldown
        if (userCooldowns.has(userId)) {
            const cooldownEnd = userCooldowns.get(userId);
            if (currentTime < cooldownEnd) {
                // Usuário ainda está em cooldown, deletar mensagem
                try {
                    await message.delete();
                } catch (error) {
                    console.error('Erro ao deletar mensagem durante cooldown:', error);
                }
                return;
            } else {
                // Cooldown expirou, remover
                userCooldowns.delete(userId);
            }
        }

        // Inicializar dados do usuário se não existir
        if (!userMessages.has(userId)) {
            userMessages.set(userId, {
                messages: [],
                duplicates: new Map()
            });
        }

        const userData = userMessages.get(userId);
        const messageContent = message.content.toLowerCase().trim();

        // Adicionar mensagem ao histórico
        userData.messages.push({
            content: messageContent,
            timestamp: currentTime,
            messageId: message.id
        });

        // Contar mensagens duplicadas
        if (messageContent.length > 0) {
            const duplicateCount = userData.duplicates.get(messageContent) || 0;
            userData.duplicates.set(messageContent, duplicateCount + 1);
        }

        // Limpar mensagens antigas (fora da janela de tempo)
        userData.messages = userData.messages.filter(msg => 
            currentTime - msg.timestamp <= SPAM_CONFIG.timeWindow
        );

        // Limpar duplicatas antigas
        for (const [content, count] of userData.duplicates.entries()) {
            const recentMessages = userData.messages.filter(msg => msg.content === content);
            if (recentMessages.length === 0) {
                userData.duplicates.delete(content);
            } else {
                userData.duplicates.set(content, recentMessages.length);
            }
        }

        // Verificar spam por quantidade de mensagens
        const isSpamByQuantity = userData.messages.length > SPAM_CONFIG.maxMessages;

        // Verificar spam por mensagens duplicadas
        const isSpamByDuplicates = Array.from(userData.duplicates.values())
            .some(count => count >= SPAM_CONFIG.duplicateThreshold);

        // Se detectou spam
        if (isSpamByQuantity || isSpamByDuplicates) {
            try {
                // Deletar mensagens recentes do usuário
                const messagesToDelete = userData.messages.slice(-SPAM_CONFIG.maxMessages);
                for (const msgData of messagesToDelete) {
                    try {
                        const msgToDelete = await message.channel.messages.fetch(msgData.messageId);
                        await msgToDelete.delete();
                    } catch (deleteError) {
                        // Mensagem já pode ter sido deletada
                        console.log('Mensagem já deletada ou não encontrada:', deleteError.message);
                    }
                }

                // Aplicar cooldown
                userCooldowns.set(userId, currentTime + SPAM_CONFIG.cooldownTime);

                // Criar container de aviso
                const container = new ContainerBuilder()
                    .setContent(
                        `🚫 **Anti-Spam Ativado**\n\n` +
                        `${message.author}, você foi detectado fazendo spam!\n\n` +
                        `⚠️ **Ação Tomada:** Suas mensagens foram removidas automaticamente.\n` +
                        `⏰ **Cooldown:** Você não poderá enviar mensagens por ${SPAM_CONFIG.cooldownTime / 1000} segundos.\n` +
                        `📋 **Motivo:** ${isSpamByQuantity 
                            ? `Muitas mensagens em pouco tempo (${userData.messages.length}/${SPAM_CONFIG.maxMessages})`
                            : `Mensagens repetidas detectadas`}\n\n` +
                        `Por favor, evite fazer spam no servidor.`
                    )
                    .setAuthor({
                        name: "Sistema Anti-Spam",
                        iconURL: message.guild.iconURL() || message.author.displayAvatarURL({ dynamic: true })
                    })
                    .setFlags(MessageFlags.IsComponentsV2);

                // Enviar aviso (mensagem temporária)
                const warningMessage = await message.channel.send(container);

                // Deletar aviso após 10 segundos
                setTimeout(async () => {
                    try {
                        await warningMessage.delete();
                    } catch (error) {
                        console.log('Aviso já foi deletado:', error.message);
                    }
                }, 10000);

                // Limpar dados do usuário
                userData.messages = [];
                userData.duplicates.clear();

                console.log(`Anti-spam ativado para ${message.author.tag} (${message.author.id})`);

            } catch (error) {
                console.error('Erro no sistema anti-spam:', error);
            }
        }

        // Limpar dados antigos periodicamente
        if (Math.random() < 0.01) { // 1% de chance a cada mensagem
            cleanOldData();
        }
    });
};

// Função para limpar dados antigos
function cleanOldData() {
    const currentTime = Date.now();
    
    // Limpar mensagens antigas
    for (const [userId, userData] of userMessages.entries()) {
        userData.messages = userData.messages.filter(msg => 
            currentTime - msg.timestamp <= SPAM_CONFIG.timeWindow * 2
        );
        
        if (userData.messages.length === 0) {
            userData.duplicates.clear();
        }
        
        // Remover usuários sem dados
        if (userData.messages.length === 0 && userData.duplicates.size === 0) {
            userMessages.delete(userId);
        }
    }
    
    // Limpar cooldowns expirados
    for (const [userId, cooldownEnd] of userCooldowns.entries()) {
        if (currentTime >= cooldownEnd) {
            userCooldowns.delete(userId);
        }
    }
}