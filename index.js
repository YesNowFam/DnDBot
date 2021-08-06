// #region Requirements
require('dotenv').config()
const Discord = require('discord.js')
const client = new Discord.Client()
//const guildId = '868473655657631764'
const guildId = '533699514490421250'
const mainId = '1sHt2cgsMCTYFrvyOkbsbxjm56ASRU4wu1bZ3C58AVqE'

const { createCanvas, loadImage } = require('canvas')
const crypto = require("crypto")
const { google, run_v1 } = require("googleapis");
const fs = require('fs');
const readline = require('readline');
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require('constants')
// #endregion

// #region OAuth2
 const TOKEN_PATH = 'token.json'
 const CRED_PATH = 'credentials.json'
 var mainAuth

 if (fs.existsSync(CRED_PATH)) {
     var credentials = JSON.parse(fs.readFileSync(CRED_PATH,
         { encoding: 'utf8', flag: 'r' }))

     const { client_secret, client_id, redirect_uris } = credentials.installed
     mainAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

     if (fs.existsSync(TOKEN_PATH)) {
         var token = JSON.parse(fs.readFileSync(TOKEN_PATH,
             { encoding: 'utf8', flag: 'r' }))
     }
     else {

         const authUrl = mainAuth.generateAuthUrl({
             access_type: 'offline',
             scope: ['https://www.googleapis.com/auth/spreadsheets'],
         })

         console.log('Authorize this app by visiting this url:', authUrl)

         const prompt = require('prompt-sync')()
         const code = prompt('Enter the code from that page here: ');

         mainAuth.getToken(code, (err, token) => {
             if (err) {
                 console.error('Error while trying to retrieve access token', err)
                 process.exit(1)
             }
             mainAuth.setCredentials(token)
             fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                 if (err) return console.error(err)
                 console.log('Token stored to', TOKEN_PATH)
             })
         })

     }

     mainAuth.setCredentials(token)
 }
 else {
     console.log('No credentials pal...')
     process.exit(1)
 }

 const mainSheet = google.sheets({ version: 'v4', mainAuth })
 // #endregion

// #region Service account
const famAuth = new google.auth.GoogleAuth({
    keyFile: 'keys.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})
const famAuthClient = famAuth.getClient()
const famSheet = google.sheets({ version: "v4", auth: famAuthClient })
// #endregion

// #region Get app
const getApp = (guildId) => {
    const app = client.api.applications(client.user.id)
    if (guildId) {
        app.guilds(guildId)
    }
    return app
}
// #endregion

// #region Sheet functions
async function sheetAppend(sheets, auth, id, range, values) {
    await sheets.spreadsheets.values.append({
        auth: auth,
        spreadsheetId: id,
        range: range,
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [values],
        }
    })
}

async function sheetUpdate(sheets, auth, id, range, values) {
    await sheets.spreadsheets.values.update({
        auth: auth,
        spreadsheetId: id,
        range: range,
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [values],
        }
    })
}

async function sheetGet(sheets, auth, id, range) {
    content = await sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: id,
        range: range,
    })
    return content.data['values']
}
// #endregion

var c = {
    dead: 1,
    blinded: 2,
    charmed: 3,
    deafened: 4,
    frightened: 5,
    grappled: 6,
    incapacitated: 7,
    invisible: 8,
    paralyzed: 9,
    petrified: 10,
    poisned: 11,
    prone: 12,
    restrained: 13,
    stunned: 14,
    unconscious: 16,
    exhaustion1: 17,
    exhaustion2: 18,
    exhaustion3: 19,
    exhaustion4: 20,
    exhaustion5: 21,
    exhaustion6: 22,
}

var a = {
    normal: 0,
    advantage: 1,
    disadvantage: -1,
}

// #region Player Class
class Player {
    constructor(id, user, ac, hp, stats, level, weaponArray, name, initMod, attackCount) {
        // #region this
        this.id = id
        this.user = user
        this.channel = undefined
        this.message = undefined
        this.ac = ac
        this.hp = hp
        this.hpMax = hp
        this.stats = stats
        this.level = level
        this.proficieny = Math.floor((level - 1) / 4) + 2
        this.weaponArray = weaponArray
        this.name = name
        this.initMod = initMod
        this.init = 0
        this.conditions = []
        this.attackMax = attackCount
        this.attackCount = attackCount
        this.attackAdv = a.normal
        this.attackAgainstAdv = a.normal
        this.initAdv = a.normal
        this.actionCount = 1
        this.actionBonus = 1
        this.turn = false
        // #endregion

        let mods = []
        for (const stat of stats) {
            mods.push(Math.floor(stat / 2) - 5)
        }

        this.mods = mods
    }

    static async build(sheets, auth, id, user, letters = ['J', 'V', 'AH', 'AT']) {

        const ac = parseInt((await sheetGet(sheets, auth, id, 'Equipment!D46'))[0][0])
        const hp = parseInt((await sheetGet(sheets, auth, id, 'Online Sheet!L52'))[0][0])
        const initMod = parseInt((await sheetGet(sheets, auth, id, 'Online Sheet!BE52'))[0][0])
        const attackCount = parseInt((await sheetGet(sheets, auth, id, 'Online Sheet!AM59'))[0][0])

        const name = (await sheetGet(sheets, auth, id, 'Start!J38'))[0][0]
        const level = parseInt((await sheetGet(sheets, auth, id, 'Start!C53'))[0][0])
        const stats = await sheetGet(sheets, auth, id, 'Start!BB27:BB32')

        //make a weapon sheet and a spell sheet
        let weaponArray = []
        /*
         [
            [ 'Light Crossbow ' ],
            [ 'Simple Ranged Weapons' ],
            [ 'Proficient' ],
            [ '+7' ],
            [ '2 hand' ],
            [ '1d8+4' ],
            [ 'piercing' ],
            [ '80/320' ],
            [ '5 lb' ],
            [ 'Ammunition, loading, two-handed' ]
        ]
        */
        for (const e of letters) {
            var values = (await sheetGet(sheets, auth, id, `Equipment!${e}12:${e}21`))
            if (values != undefined) {
                weaponArray.push({
                    name: values[0][0],
                    type: values[1][0],
                    attack: `1d20${values[3][0]}`,
                    hand: parseInt(values[4][0][0]),
                    damage: values[5][0],
                    damagetype: values[6][0],
                    range: values[7][0],
                    properties: values[9][0]
                })
            }
        }

        //console.log(((await sheetGet(sheets, auth, id, 'Equipment!BG7'))[0][0]).substring(4))
        weaponArray = this.switchWeapon(weaponArray,
            ((await sheetGet(sheets, auth, id, 'Equipment!BG7'))[0][0]).substring(4)
        )

        for (var i = 0; i < stats.length; i++) {
            stats[i] = parseInt(stats[i][0])
        }

        return new Player(id, user, ac, hp, stats, level, weaponArray, name, initMod, attackCount)
    }

    // #region Get and set
    set Channel(value) {
        this.channel = value
    }

    get Channel() {
        return this.channel
    }

    set Message(value) {
        this.message = value
    }

    get Message() {
        return this.message
    }

    set AttackCount(value) {
        if (value > 0) {
            this.ActionCount -= 1
        }
        this.attackCount = value
    }

    get AttackCount() {
        return this.attackCount
    }

    set ActionCount(value) {
        this.actionCount = value
        if (this.turn) {
            this.turn = (value == 0 && this.actionBonus == 0)
        }
    }

    get ActionCount() {
        return this.actionCount
    }

    set ActionBonus(value) {
        this.actionBonus = value
        this.turn = (value == 0 && this.actionCount == 0)
    }

    get ActionBonus() {
        return this.actionBonus
    }

    set Turn(value) {
        this.turn = value
    }

    get Turn() {
        return this.turn
    }

    set Hp(value) {
        if (value < 0) {
            if (Math.abs(value) < this.hpMax) {
                this.updateConditions(c.unconscious)
            }
            else {
                this.updateConditions(c.dead)
            }
            console.log(this.name, this.conditions)
            this.hp = 0
        }
        else {
            this.hp = value
        }
    }

    get Hp() {
        return this.hp
    }

    set Init(value) {
        this.init = value
    }

    get Init() {
        return this.init
    }
    
    get Stats() {
        return this.stats
    }

    get WeaponArray() {
        return this.weaponArray
    }

    get Name() {
        return this.name
    }

    get AttackAdv() {
        return this.attackAdv
    }

    get AttackAgainstAdv() {
        return this.attackAgainstAdv
    }

    get Mods() {
        return this.mods
    }

    get Conditions() {
        return this.conditions
    }

    get User() {
        return this.user
    }
    
    get Id() {
        return this.id
    }

    get Heart() {
        return this.hp / this.hpMax > 0.5 ? ':green_heart:' :
                (this.hp / this.hpMax > 0.25 ? ':yellow_heart:' : 
                    (this.hp > 0 ? ':heart:' : ':skull:')
                )
    }
    // #endregion

    static switchWeapon(weaponArray, name) {
        for (var i = 0; i < weaponArray.length; i++) {
            if (weaponArray[i].name == name) {
                var w = (weaponArray.splice(i, 1))[0]
                weaponArray.unshift(w)
                break
            }
        }
        return weaponArray
    }

    updateChannelEmbed() {
        const embed = new Discord.MessageEmbed().setTitle(`${this.name} :vampire_tone5:`)
        embed.addField('Health', `${this.Heart} ${this.hp} HP`)
        embed.addField('Actions', `${this.actionCount} left`)
        embed.addField('Bonus Actions', `${this.actionBonus} left`)
        this.Message.edit({ embed: embed })
    }

    updateConditions(condition) {
        this.conditions.push(condition)
        if (condition = c.blinded) {

        }
    }

    updateWeapon(name) {
        this.weaponArray = this.switchWeapon(this.weaponArray, name)
    }

    resetActions() {
        this.actionCount = 1
        this.actionBonus = 1
        this.attackCount = this.attackMax
    }

    rollAttack(targetAdv) {
        var r1 = roll(this.weaponArray[0].attack, false)
    
        var adv = calculateAdv(targetAdv, this.attackAdv)
        var advStr = getAdvStr(adv)

        var r = applyRollAdv(adv, this.weaponArray[0].attack)
        if(adv != a.normal) {
            if (r[2]) {
                r[0][1] = `~~${r[1][1]}~~\n${r[0][1]}` //r1 is crossed
            }
            else {
                r[0][1] = `${r[0][1]}\n~~${r[1][1]}~~` //r2 is crossed
            }
        }
        r[0].push(advStr)
        return r[0]
    }

    rollDamage(crit) {
        return roll(this.weaponArray[0].damage, crit)
    }

    rollInit() {
        return applyRollAdv(this.initAdv, `1d20+${this.initMod}`)[0][0]
    }
}
// #endregion

// #region Adv functions
function calculateAdv(targetAdv, playerAdv) {
    var adv = targetAdv + playerAdv
    if (Math.abs(adv)==2) {
        adv = adv/2
    }
    return adv
}

function applyRollAdv(adv, rollStr) {
    r1 = roll(rollStr, false)
    r2 = roll(rollStr, false)
    var r2Bigger = r2[0] > r1[0]

    if(adv == a.advantage && r2Bigger
    || adv == a.disadvantage && !r2Bigger) {
        return [r2, r1, r2Bigger]
    }
    else {
        return [r1, r2, r2Bigger]
    }
}

function getAdvStr(adv) {
    return adv == a.normal ? '' : (adv == a.advantage ? 'Advantage' : 'Disadvantage')
}
// #endregion

// #region Rollers
function roll(r, crit) {
    r = r.toLowerCase()
    times = r.match(/[0-9]+(?=d)/g).map(function (e) { return parseInt(e)*(crit+1) }) //'1'd
    dices = r.match(/(?<=d)[0-9]+/g).map(function (e) { return parseInt(e) }) //d'20'

    if (times.length != dices.length) {
        return -1
    }

    adds = r.match(/(?<=[+])(?<!d)[0-9]+(?!d)/g).map(function (e) { return parseInt(e) }) //+'4'

    let result = 0
    let resultStr = ''
    let diceStr = ''
    for (var i = 0; i < times.length; i++) {
        for (var j = 0; j < times[i]; j++) {
            var n = crypto.randomInt(1, dices[i]+1)
            //console.log(n)
            if (n == dices[i]) {
                resultStr += `+ (**${n}**) `
            }
            else {
                resultStr += `+ (${n}) `
            }
            result += n
        }
        diceStr += `+${times[i]}d${dices[i]}`
    }

    for (const a of adds) {
        resultStr += `+ ${a} `
        diceStr += `+${a}`
        result += a
    }
    resultStr = resultStr.substring(1)
    resultStr += '= `'+result.toString()+'`'

    diceStr = diceStr.substring(1)

    return [result, resultStr, diceStr]
}

function getCritImage()
{
    const canvas = createCanvas(120, 50)
    const ctx = canvas.getContext('2d')

    var gradient = ctx.createLinearGradient(20, 0, 220, 0);

    // Add three color stops
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(.5, 'yellow');
    gradient.addColorStop(1, 'red');

    ctx.font = '20px Impact'
    ctx.fillStyle = gradient
    ctx.rotate(0.1)
    ctx.fillText('Critical Hit!', 15, 25)

    const buffer = canvas.toBuffer('image/png')
    fs.writeFileSync('./crit.png', buffer)
}
// #endregion

// #region Embed functions
function getCharforgeEmbed(id) {
    const embed = new Discord.MessageEmbed().setTitle('```Registering```')
    embed.addField('```' + id + '```', 'Sheet ID')

    return embed
}

function getStatsEmbed(entity, statLabels = ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    const embed = new Discord.MessageEmbed().setTitle('Stats :chart_with_downwards_trend:')

    for (var i = 0; i < 6; i++) {
        embed.addField(statLabels[i],
            `**${entity.Stats[i]}**`
            + (entity.Mods[i] < 0 ? ' ('+ entity.Mods[i].toString() : ' (+' + entity.Mods[i].toString()) + ')' 
            , true)
    }

    return embed
}

function getInitEmbed(entityArray) {
    const embed = new Discord.MessageEmbed().setTitle('Initiative :clipboard:')
    for (var i = 0; i < entityArray.length; i++) {
        embed.addField(`${i+1}. ${entityArray[i].Name} ${entityArray[i].Turn ? '<--' : ''} `
            , entityArray[i].Heart + '` HP Score (' + entityArray[i].Init.toString() + ')`')
    }

    return embed
}

function getAttackEmbed(toHit, name, hits) {
    const embed = new Discord.MessageEmbed().setTitle('Attack :crossed_swords:')

    embed.addField(`Roll: ${toHit[2]} ${toHit[3]}`
        , 'Result:\n' + toHit[1])

    embed.addField(`Target: ${name}`, 'Result: `' + (hits ? 'hits!` :sunglasses:' : 'misses `:sob:' ))

    return embed
}

function getDamageEmbed(damage) {
    const embed = new Discord.MessageEmbed().setTitle(
        'Damage :woman_cartwheeling:\n                  :manual_wheelchair: :man_golfing:')

    embed.addField(`Damage: ${damage[2]}`
        , 'Result: ' + damage[1])

    return embed
}

async function createChannelEmbed(guild, parent, player) {
    await guild.channels.create(player.Name, {
        type: 'text',
        parent,
        /*permissionOverwrites: [
            {id: guild.id, deny: ['VIEW_CHANNEL']},
            {id: player.User, allow: ['VIEW_CHANNEL']},
        ]*/
    }).then(channel => {
        player.Channel = channel
        channel.send(new Discord.MessageEmbed()
                        .setTitle('Sample Text')
                        .addField('Lorem ispum', 'Dolor'))
        .then(msg => {
            console.log(player.Name)
            player.Message = msg
            msg.pin()
            player.updateChannelEmbed()
        })
    })
}
// #endregion

// #region Reply functions
const reply = async (interaction, response) => {
    let data = { content: response }

    if (typeof (response) === 'object') {
        data = await createAPIMessage(interaction, response)
    }

    client.api.interactions(interaction.id, interaction.token).callback.post({
        data:
        {
            type: 4,
            data
        }
    })
}

const createAPIMessage = async (interaction, content) => {
    const { data, files } = await Discord.APIMessage.create(
        client.channels.resolve(interaction.channel_id),
        content
    )
        .resolveData()
        .resolveFiles()

    return { ...data, files }
}

const blank = (interaction) => {
    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 5,
        },
    })
}

function pingUser(channel, id, content) {
    channel.send(`<@${id}> ${content}`)
}
// #endregion

// #region Charforge functions
async function getUserArrayFromSheet(sheets, auth) {

    let users = []
    let ids = []
    let y = 1 //current y value of sheet
    let cell = 69

    while (cell != undefined) {
        cell = (await sheetGet(sheets, auth, mainId, `A${y}:B${y}`))

        if (cell != undefined) {
            users.push(cell[0][0])
            ids.push(cell[0][1])
        }

        y++
    }
    console.log(users)
    return { users, ids }
}
// #endregion

// #region Combat functions 
function checkForConditions(channel, entityArray) {
    for(var i = 0; i < entityArray.length; i++) {
        if (entityArray[i].Conditions.includes(c.unconscious)) {
            channel.send('`' + entityArray[i].Name +  ' is unconcious!`')
            //entityArray.splice(i, 1)
        }
        else if (entityArray[i].Conditions.includes(c.dead)) {
            channel.send('`' + entityArray[i].Name +  ' is dead!!!!!!!` :sob: :sob:')
            //entityArray.splice(i, 1)
        }
    }
}

function updateEntityOrder(entityArray) {
    entityArray.sort(function (a, b) { return b.Init - a.Init })
}

function checkNextEntityTurn(entity, entityArray) {
    if (!entity.Turn) {
        playerIdx = entityArray.indexOf(entity)

        if(playerIdx == entityArray.length-1) {
            entityArray[0].Turn = true
        }
        else {
            entityArray[playerIdx+1].Turn = true
        }
    }   
}
// #endregion

// #region Discord start
client.on('ready', async () => {

    console.log(`Logged in as ${client.user.tag}!`)

    // #region Slash commands
    const app = getApp(guildId)
    app.commands.post({
        data: {
            name: 'charforge',
            description: 'loads character from google sheets id',
            options:
                [{
                        name: 'id',
                        description: 'google sheet id (from the link of the sheet)',
                        required: true,
                        type: 3
                    }
                ]
        }
    })

    app.commands.post({
        data: {
            name: 'createchannels',
            description: 'creates or updates channels for each character',
        }
    })

    app.commands.post({
        data: {
            name: 'stats',
            description: 'shows current character stats'
        }
    })

    app.commands.post({
        data: {
            name: 'attack',
            description: 'attacks an enemy in range',
            options:
                [{
                        name: 'target',
                        description: 'the number of the target to attack in the initative order',
                        required: false,
                        type: 4
                    }
                ]
        }
    })

    app.commands.post({
        data: {
            name: 'combat',
            description: 'initiates combat',
            options:
                [{
                        name: 'action',
                        description: '"start" starts combat; "end" ends combat',
                        required: false,
                        type: 3
                    }
                ]
        }
    })
    // #endregion

    let combat = false
    let entityArray = []
    var channelArray = client.guilds.cache.get(guildId).channels.cache
    var category = channelArray.find(s => s.type == 'category' && s.name == 'Characters')
    var gmArray = ['combat', 'createchannels']
    var combatArray = ['attack']
    var currentTurn
    var initMessage

    // #region Pre-processing users
    //list all users and google sheet ids of the main sheet
    var { users: userArray, ids } = await getUserArrayFromSheet(mainSheet, mainAuth)

    for (var i = 0; i < userArray.length; i++) {
        var player = await Player.build(famSheet, famAuth, ids[i], userArray[i])

        var channelName = player.Name.toLowerCase().replace(/[^A-z0-9]/g,'-').replace(/[-]+/g,'-')
        if (channelName[channelName.length-1] == '-') {
            channelName = channelName.substring(0,channelName.length-1)
        }

        if(category) {
            player.Channel = channelArray.find(s => s.name == channelName)
            player.Channel.messages.fetch().then(messages => {
                player.Message = messages.find(m => m.author.id == client.user.id && m.pinned)
            })
            player.Channel.send('sup')
        }
        entityArray.push(player)
    }

    console.log('done')
    // #endregion

    // #region Discord interaction
    client.ws.on('INTERACTION_CREATE', async (interaction) => {

        // #region Parsing arguments
        const { name, options } = interaction.data
        const command = name.toLowerCase()
        const args = {}

        if (options) {
            for (const option of options) {
                const { name, value } = option
                args[name] = value
            }
        }
        // #endregion

        let user = interaction.member.user
        let channel = client.channels.cache.get(interaction.channel_id)
        let guild = client.guilds.cache.get(interaction.guild_id)
        let gm = interaction.member.roles.find(r => guild.roles.cache.get(r).name == 'GM')
        let entity = entityArray.find(e => e.User == user.id)

        if (gmArray.includes(command) && !gm) {
            reply(interaction, '`You are not the gm pal...`')
        }

        else if (gmArray.includes(command)) {
            // #region Combat
            if (command == 'combat') {
                if (args.action == 'start' && !combat) {
                    combat = true
                    reply(interaction, '`Rolling initiative...!`')

                    for (const e of entityArray) {
                        e.Init = e.rollInit()
                    }
                    updateEntityOrder(entityArray)
                    entityArray[0].Init = 8
                    entityArray[1].Init = 8

                    //check for equal intiatives
                    for (var i = 0; i < entityArray.length-1; i++) {
                        if (entityArray[i].Init == entityArray[i + 1].Init) {
                            let r1 = 0
                            let r2 = 0
                            while (r1 == r2) {
                                r1 = entityArray[i].rollInit()
                                r2 = entityArray[i + 1].rollInit()
                                console.log(r2,r1)
                                if (r2 > r1) {
                                    entityArray[i], entityArray[i+1] = entityArray[i+1], entityArray[i]
                                }
                            }
                        }
                    }
                    entityArray[0].Turn = true

                    await channel.send({ embed: getInitEmbed(entityArray) }).then(msg => { msg.pin() })
                    initMessage = client.users.cache.find(u => u.tag === 'D&Deez#0819').lastMessage
                }

                else if (args.action == 'end' && combat) {
                    combat = false
                    reply(interaction, '`Combat is over!`')

                    entityArray = []
                    initMessage.delete({timeout: '1'})

                    for (const e of entityArray) {
                        e.Turn = false
                    }
                }
                else {
                    reply(interaction, '`Combat has already been started or ended mate...`')
                }
            }
            // #endregion

            // #region Channels
            else if (command == 'createchannels') {
                guild.channels.create('Characters', {
                    type: 'category',
                }).then(parent => {
                    category = parent
                    guild.members.fetch().then(async (members) => {
                        for await (var e of entityArray) {
                            if (members.find(m => m.user.id == e.User)) {
                                await createChannelEmbed(guild, parent, e)
                            }
                        }
                    })
                })
            }
            // #endregion
        }

        else {
            console.log('yeeet')

            if (!category) {
                reply(interaction, '`You must create character channels first...`')
            }
    
            else if (!entity) {
                reply(interaction, '`You must have a player...`')
            }
    
            else if (combatArray.includes(command) && !combat) {
                reply(interaction, '`You are not in combat mate...`')
            }

            else if (combatArray.includes(command)) {

                if (!entity.Turn) {
                    reply(interaction, '`Its not your turn anymore...`')
                }

                else {
                    // #region Action commands
                    if (command == 'attack') {
                        entity.AttackCount -= 1
                        
                        if (entityArray[args.target - 1]) {
                            var target = entityArray[args.target - 1]
                            var toHit = entity.rollAttack(target.AttackAgainstAdv)

                            var hits = target.ac <= toHit[0]
                            reply(interaction, getAttackEmbed(toHit, target.Name, hits))

                            let damage;
                            if (toHit[1].includes('*')) {
                                channel.send({ files: ["./crit.png"] })
                                damage = entity.rollDamage(true)
                            }
                            else {
                                damage = entity.rollDamage(false)
                            }

                            if (hits) {
                                target.Hp -= damage[0]
                                console.log(target.Name, target.Hp)
                                channel.send(getDamageEmbed(damage))
                                checkForConditions(channel, entityArray)
                            }
                        }
                        else {
                            reply(interaction, '`Invalid target...`')
                        }
                        

                        checkNextEntityTurn(entity, entityArray)
                    }

                    for(const e of entityArray) {
                        if (e.Channel) {
                            e.updateChannelEmbed()
                        }
                    }

                    initMessage.edit({ embed: getInitEmbed(entityArray) })
                    // #endregion

                }

            }

            else {
                // #region Charforge
                if (command == 'charforge') {
                    reply(interaction, getCharforgeEmbed(args.id))

                    try {
                        var newPlayer = await Player.build(famSheet, famAuth, args.id, user.id)
                        var duplicatePlayer = entityArray.find(e => e.Id == newPlayer.Id && e.User != newPlayer.User)

                        if (!duplicatePlayer) {
                            //no instance of user in main sheet
                            if (!userArray.includes(user.id)) {
                                await sheetAppend(mainSheet, mainAuth, mainId, 'A1:B1', [user.id, args.id])
                                userArray.push(user.id)
                            }
                            //instance of user in main sheet
                            else {
                                await sheetUpdate(mainSheet, mainAuth, mainId,
                                    `B${userArray.indexOf(user.id) + 1}`, [args.id])
                                entityArray.splice(entityArray.findIndex(e => e.User == user.id), 1)
                            }

                            if (category) {
                                entity.Channel.delete()
                                createChannelEmbed(guild, category, newPlayer)
                            }

                            if (combat) {
                                newPlayer.Init = newPlayer.rollInit()
                                entityArray.push(newPlayer)
                                updateEntityOrder(entityArray)
                            }
                            else {
                                entityArray.push(newPlayer)
                            }
                            pingUser(channel, user.id, '`Registered!`')

                            console.log(entityArray.length)
                        }
                        else {
                            pingUser(channel, user.id, '`Two players cannot have the same character...`')
                        }

                    } 
                    catch(err) {
                        pingUser(channel, user.id, '`'+err+'`')
                    }
                    
                }
                // #endregion

                // #region Stats
                if (command == 'stats') {
                    reply(interaction, getStatsEmbed(entity))
                }
                // #endregion
            
            }

        }

    })
    // #endregion
})
// #endregion

// #region Login
client.login(process.env.token)
// #endregion
