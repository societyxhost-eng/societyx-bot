require('dotenv/config');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  DEPLOY_SCOPE = 'guild',
} = process.env;

if (!TOKEN || !CLIENT_ID || (DEPLOY_SCOPE === 'guild' && !GUILD_ID)) {
  console.error('✖ Env faltando. Necessário: TOKEN, CLIENT_ID' + (DEPLOY_SCOPE === 'guild' ? ', GUILD_ID' : ''));
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

function loadSlashCommands(commandsDir) {
  const commands = [];
  const ignored = [];

  const files = fs
    .readdirSync(commandsDir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith('.js'))
    .map(d => d.name);

  for (const file of files) {
    const fullPath = path.join(commandsDir, file);

    // limpa cache para garantir require fresco
    delete require.cache[require.resolve(fullPath)];

    let mod;
    try {
      mod = require(fullPath);
    } catch (err) {
      console.error(`✖ Erro ao carregar ${file}:`, err.message);
      ignored.push(file);
      continue;
    }

    if (mod?.data && typeof mod.data.toJSON === 'function') {
      const json = mod.data.toJSON();
      // anexa metadados para debug
      commands.push({ __file: file, ...json });
    } else {
      ignored.push(file);
    }
  }

  return { commands, ignored };
}

function reportDuplicates(commands) {
  const byName = new Map();
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    if (!byName.has(c.name)) byName.set(c.name, []);
    byName.get(c.name).push({ index: i, file: c.__file });
  }

  const dups = [];
  for (const [name, arr] of byName) {
    if (arr.length > 1) dups.push({ name, refs: arr });
  }
  return dups;
}

async function deploy() {
  const commandsPath = path.join(__dirname, 'commands');
  const { commands, ignored } = loadSlashCommands(commandsPath);

  console.log(`Encontrados ${commands.length} comandos para publicar.`);
  if (ignored.length) {
    console.log(`Ignorados (${ignored.length}): ${ignored.join(', ')}`);
  }

  // Log detalhado dos comandos
  console.log('Lista de comandos (índice -> nome | arquivo):');
  commands.forEach((c, idx) => {
    console.log(`${idx} -> ${c.name} | ${c.__file}`);
  });

  // Detecta duplicados
  const duplicates = reportDuplicates(commands);
  if (duplicates.length) {
    console.error('✖ Duplicatas encontradas (nomes de comandos devem ser únicos):');
    for (const dup of duplicates) {
      const refs = dup.refs.map(r => `idx ${r.index} (${r.file})`).join(', ');
      console.error(`- ${dup.name}: ${refs}`);
    }
    console.error('Corrija os nomes duplicados (setName) ou remova arquivos duplicados e rode o deploy novamente.');
    process.exit(1);
  }

  // Remove metadados antes de enviar
  const payload = commands.map(({ __file, ...rest }) => rest);

  try {
    console.log(
      DEPLOY_SCOPE === 'global'
        ? 'Publicando comandos GLOBAIS... (podem levar até 1h para propagar)'
        : `Publicando comandos no servidor ${GUILD_ID}...`
    );

    const route =
      DEPLOY_SCOPE === 'global'
        ? Routes.applicationCommands(CLIENT_ID)
        : Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID);

    await rest.put(route, { body: payload });

    console.log('✔ Comandos atualizados!');
  } catch (err) {
    console.error('✖ Falha ao atualizar comandos:');
    if (err?.rawError?.errors) {
      console.error('Detalhes de erros por índice:', JSON.stringify(err.rawError.errors, null, 2));
    }
    console.error(err);
    process.exit(1);
  }
}

deploy();