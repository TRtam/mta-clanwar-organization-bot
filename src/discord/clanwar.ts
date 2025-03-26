import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  Message,
  OmitPartialGroupDMChannel,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import { sequelize } from "@database/sqlite";
import { createHash } from "crypto";
import { msToTimeStr, removeHexColors } from "@helpers/string";
import { getFormattedDate } from "@helpers/date";

const roles = process.env.DISCORD_CLANWAR_ROLES?.split(",") || [];

interface Toptime {
  playerName: string;
  time: number;
}

async function get_map_toptimes(mapName: string): Promise<Toptime[]> {
  const results = await sequelize.query(
    "SELECT `playerName`, `time` FROM `toptimes` WHERE `mapNameHash`=:mapNameHash ORDER BY `time` LIMIT 5",
    {
      replacements: {
        mapNameHash: createHash("md5")
          .update(mapName)
          .digest("hex")
          .toUpperCase(),
      },
      type: "SELECT",
    }
  );
  return (results as Toptime[]) || [];
}

async function create_clanwar_channel(
  guild: Guild,
  name: string,
  date: string,
  ourmaps: string[],
  visitormaps: string[]
) {
  const category = await guild.channels.create({
    name: `CW ${name}`,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...roles.map((role) => ({
        id: role,
        allow: [PermissionFlagsBits.ViewChannel],
      })),
    ],
  });

  const register_channel = await guild.channels.create({
    parent: category,
    name: "register",
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...roles.map((role) => ({
        id: role,
        allow: [PermissionFlagsBits.ViewChannel],
      })),
    ],
  });

  const embed = new EmbedBuilder();
  embed.setTitle("Registered Players");
  embed.setDescription("No Players registered");

  const register_button = new ButtonBuilder()
    .setCustomId("register_clanwar")
    .setLabel("Register")
    .setStyle(ButtonStyle.Primary);

  const unregister_button = new ButtonBuilder()
    .setCustomId("unregister_clanwar")
    .setLabel("Unregister")
    .setStyle(ButtonStyle.Danger);

  const action_row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    register_button,
    unregister_button
  );

  await register_channel?.send({
    embeds: [embed],
    components: [action_row],
  });

  // date channel
  await guild.channels.create({
    parent: category,
    name: date,
    type: ChannelType.GuildVoice,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.ViewChannel,
        ],
      },
      ...roles.map((role) => ({
        id: role,
        allow: [PermissionFlagsBits.ViewChannel],
      })),
    ],
  });

  const maplist_channel = await guild.channels.create({
    parent: category,
    name: "maplist",
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...roles.map((role) => ({
        id: role,
        allow: [PermissionFlagsBits.ViewChannel],
      })),
    ],
  });

  await maplist_channel?.send("## Our maps");

  ourmaps.forEach(async (map) => {
    await maplist_channel?.send(`* ${map}`);
  });

  await maplist_channel?.send("## Visitor's maps");

  visitormaps.forEach(async (map) => {
    await maplist_channel?.send(`* ${map}`);
  });

  const toptimes_channel = await guild.channels.create({
    parent: category,
    name: "toptimes",
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ...roles.map((role) => ({
        id: role,
        allow: [PermissionFlagsBits.ViewChannel],
      })),
    ],
  });

  await toptimes_channel?.send("## Our toptimes");

  for (const map of ourmaps) {
    const toptimes = await get_map_toptimes(map);

    const embed = new EmbedBuilder();
    embed.setTitle(map);
    embed.setColor("Aqua");
    embed.addFields(
      [0, 1, 2, 3, 4].map((position) => {
        return {
          name: `${position + 1}.`,
          value: toptimes[position]
            ? `${removeHexColors(toptimes[position].playerName)}, ${msToTimeStr(
                toptimes[position].time
              )}`
            : "Empty",
          inline: false,
        };
      })
    );

    await toptimes_channel?.send({ embeds: [embed] });
  }

  await toptimes_channel?.send("## Visitor's toptimes");

  for (const map of visitormaps) {
    const toptimes = await get_map_toptimes(map);

    const embed = new EmbedBuilder();
    embed.setTitle(map);
    embed.setColor("Aqua");
    embed.addFields(
      [0, 1, 2, 3, 4].map((position) => {
        return {
          name: `${position + 1}.`,
          value: toptimes[position]
            ? `${removeHexColors(toptimes[position].playerName)}, ${msToTimeStr(
                toptimes[position].time
              )}`
            : "Empty",
          inline: false,
        };
      })
    );

    await toptimes_channel?.send({ embeds: [embed] });
  }
}

export default async function create_clanwar(
  guild: Guild,
  channel: TextChannel,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  await message.reply("Set the channel's name:");

  const name_collector = channel.createMessageCollector({
    filter: (msg) => msg.author.id === message.author.id,
    time: 60000,
  });

  name_collector.on("collect", async (name_message) => {
    if (name_message.content.trim().toLowerCase() === "!cancel") {
      name_collector.stop();
      await name_message.reply("Clanwar creation has been canceled.");
      return;
    }

    name_collector.stop();

    await name_message.reply(
      "Set the date of the clanwar (MM/DD/YYYY, HH:MM):"
    );
    await channel.send(`Example: ${getFormattedDate()}`);

    const date_collector = channel.createMessageCollector({
      filter: (msg) => msg.author.id === message.author.id,
      time: 60000,
    });

    date_collector.on("collect", async (date_message) => {
      if (date_message.content.trim().toLowerCase() === "!cancel") {
        date_collector.stop();
        await date_message.reply("Clanwar creation has been canceled.");
        return;
      }

      date_message.content = date_message.content.trim();

      if (
        !/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}, (0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(
          date_message.content
        )
      ) {
        await date_message.reply("Invalid date format, try again");
        return;
      }

      date_collector.stop();

      await date_message.reply("Set our map list:");
      await channel.send(
        "Each map of the list must be separated by a new line, example:"
      );
      await channel.send(
        "[DM] Cookie ft. Corrupt - Inner Fury 2\n[DM] Gteatero ft. Cookie - Deepforces\n[DM] Rampage ft. RuSO ft. Goku - Overedge\n[DM] Katge ft. MiXES ft. Saek ft. ret1p - KELOMAMEN\n[DM] Arrow ft. Chipy ft. NikotiN - Crash Report 2"
      );

      const ourmaps_collector = channel.createMessageCollector({
        filter: (msg) => msg.author.id === message.author.id,
        time: 60000,
      });

      ourmaps_collector.on("collect", async (ourmaps_message) => {
        if (ourmaps_message.content.trim().toLowerCase() === "!cancel") {
          ourmaps_collector.stop();
          await ourmaps_message.reply("Clanwar creation has been canceled.");
          return;
        }

        const ourmaps_list = ourmaps_message.content.trim().split("\n");

        if (ourmaps_list.length === 0) {
          await ourmaps_message.reply("Invalid map list, try again");
          return;
        }

        ourmaps_collector.stop();

        await ourmaps_message.reply("Set the visitor's map list:");

        const visitormaps_collector = channel.createMessageCollector({
          filter: (msg) => msg.author.id === message.author.id,
          time: 60000,
        });

        visitormaps_collector.on("collect", async (visitormaps_message) => {
          if (visitormaps_message.content.trim().toLowerCase() === "!cancel") {
            visitormaps_collector.stop();
            await visitormaps_message.reply(
              "Clanwar creation has been canceled."
            );
            return;
          }

          const visitormaps_list = visitormaps_message.content
            .trim()
            .split("\n");

          if (visitormaps_list.length === 0) {
            await visitormaps_message.reply("Invalid map list, try again");
            return;
          }

          visitormaps_collector.stop();

          await visitormaps_message.reply("Creating channel...");

          await create_clanwar_channel(
            guild,
            name_message.content,
            date_message.content,
            ourmaps_list,
            visitormaps_list
          );

          await visitormaps_message.reply("Done!");
        });
      });
    });
  });
}
