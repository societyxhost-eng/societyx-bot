require('dotenv').config();
const {
  Client, GatewayIntentBits, Collection, Events, ActivityType,
  Partials, REST, Routes
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const connectDB = require('./db');
connectDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
  }
}

const modalHandler = require('./commands/modal-handler');
modalHandler(client);

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  const body = client.commands.map(c => c.data.toJSON());
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body }
  );
  console.log('✅ Slash commands registrados.');
}

client.once(Events.ClientReady, async c => {
  console.log(`🤖 Logado como ${c.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'discord.gg/societyx 💜', type: ActivityType.Playing }],
    status: 'dnd',
  });

  try {
    await registerCommands();
  } catch (e) {
    console.error('Erro ao registrar comandos:', e);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
      const customId = interaction.customId ?? '';

      if (customId.startsWith('ticket_') || customId.startsWith('transcript_')) {
        const ticketCommand = client.commands.get('ticket');
        if (ticketCommand?.handleComponent) {

          await ticketCommand.handleComponent(interaction);
        }
      }
    }
  } catch (err) {
    console.error('Erro na interactionCreate:', err);
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Ocorreu um erro ao processar esta ação.', ephemeral: true }).catch(console.error);
    } else if (!interaction.replied) {
        await interaction.reply({ content: '❌ Ocorreu um erro.', ephemeral: true }).catch(console.error);
    }
  }
});

client.login(process.env.TOKEN);