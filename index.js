// Importing Packages
const Discord = require("discord.js");
const SQLite = require("better-sqlite3");
const sql = new SQLite("./mainDB.sqlite");
const { join } = require("path");
const { readdirSync } = require("fs");

const client = new Discord.Client();

client.commands = new Discord.Collection();
const cooldowns = new Discord.Collection();
const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const talkedRecently = new Map();

// Token, Prefix, and Owner ID
const config = require("./config.json");

// Events
client.login(config.token);

client.on("ready", () => {
  // Check if the table "points" exists.
  const levelTable = sql
    .prepare(
      "SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'levels';"
    )
    .get();
  if (!levelTable["count(*)"]) {
    sql
      .prepare(
        "CREATE TABLE levels (id TEXT PRIMARY KEY, user TEXT, guild TEXT, xp INTEGER, level INTEGER, totalXP INTEGER);"
      )
      .run();
  }

  client.getLevel = sql.prepare(
    "SELECT * FROM levels WHERE user = ? AND guild = ?"
  );
  client.setLevel = sql.prepare(
    "INSERT OR REPLACE INTO levels (id, user, guild, xp, level, totalXP) VALUES (@id, @user, @guild, @xp, @level, @totalXP);"
  );
  // Role table for levels
  const roleTable = sql
    .prepare(
      "SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'roles';"
    )
    .get();
  if (!roleTable["count(*)"]) {
    sql
      .prepare("CREATE TABLE roles (guildID TEXT, roleID TEXT, level INTEGER);")
      .run();
  }

  console.log(`Logged in as ${client.user.username}`);
});

// Command Handler
const commandFiles = readdirSync(join(__dirname, "commands")).filter(file =>
  file.endsWith(".js")
);
for (const file of commandFiles) {
  const command = require(join(__dirname, "commands", `${file}`));
  client.commands.set(command.name, command);
}

// Message Events
client.on("message", message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefixRegex = new RegExp(
    `^(<@!?${client.user.id}>|${escapeRegex(config.prefix)})\\s*`
  );
  if (!prefixRegex.test(message.content)) return;

  const [, matchedPrefix] = message.content.match(prefixRegex);

  const args = message.content
    .slice(matchedPrefix.length)
    .trim()
    .split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find(
      cmd => cmd.aliases && cmd.aliases.includes(commandName)
    );

  if (!command) return;

  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 1) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(
        `please wait ${timeLeft.toFixed(
          1
        )} more second(s) before reusing the \`${command.name}\` command.`
      );
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  try {
    command.execute(message, args);
  } catch (error) {
    console.error(error);
    message
      .reply("There was an error executing that command.")
      .catch(console.error);
  }
});

// XP Messages
client.on("message", message => {
  if (message.author.bot) return;
  // get level and set level
  const level = client.getLevel.get(message.author.id, message.guild.id);
  if (!level) {
    let insertLevel = sql.prepare(
      "INSERT OR REPLACE INTO levels (id, user, guild, xp, level, totalXP) VALUES (?,?,?,?,?,?);"
    );
    insertLevel.run(
      `${message.author.id}-${message.guild.id}`,
      message.author.id,
      message.guild.id,
      0,
      0,
      0
    );
    return;
  }

  const lvl = level.level;

  // xp system
  const generatedXp = Math.floor(Math.random() * 15);
  const nextXP = level.level * 2 * 250 + 250;
  // message content or characters length has to be more than 4 characters also cooldown
  if (talkedRecently.get(message.author.id)) {
    return;
  } else {
    // cooldown is 10 seconds
    level.xp += generatedXp;
    level.totalXP += generatedXp;

    // level up!
    if (level.xp >= nextXP) {
      level.xp = 0;
      level.level += 1;

      let ch = "793700279568433213"
      let embed = new Discord.MessageEmbed()
        .setDescription(
          `**Congratulations** ${message.author}! You have now leveled up to **level ${level.level}**`
        )
        .setColor("RANDOM")
        
      // using try catch if bot have perms to send EMBED_LINKS
      try {
        ch.send(embed);
      } catch (err) {
        message.channel.send(
          `Congratulations, ${message.author}! You have now leveled up to **Level ${level.level}**`
        );
      }
    }
    client.setLevel.run(level);
    // add cooldown to user
    talkedRecently.set(message.author.id, Date.now() + 10 * 1000);
    setTimeout(() =>
      talkedRecently.delete(message.author.id, Date.now() + 10 * 1000)
    );
  }
  // level up, time to add level roles
  const member = message.member;
  let Roles = sql.prepare(
    "SELECT * FROM roles WHERE guildID = ? AND level = ?"
  );

  let roles = Roles.get(message.guild.id, lvl);
  if (!roles) return;
  if (lvl >= roles.level) {
    if (roles) {
      if (member.roles.cache.get(roles.roleID)) {
        return;
      }
      if (!message.guild.me.hasPermission("MANAGE_ROLES")) {
        return;
      }
      member.roles.add(roles.roleID);
    }
  }
});
