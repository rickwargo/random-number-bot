"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

// Make sure you add code to validate these fields
var luisAppId = process.env['LuisAppId'];
var luisAPIKey = process.env['LuisAPIKey'];
var luisAPIHostName = process.env['LuisAPIHostName'] || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });

intents
    .onDefault(function(session) {
        var msg = 'Sorry, I did not understand \'' + session.message.text + '\'.';
        // session.send(msg);
        session.say(msg, msg);
    })
    .onBegin(function (session, args, next) {
        session.userData.lowerLimit = 1;
        session.userData.upperLimit = 100;
        var msg = 'I can give you a random number between ' + session.userData.lowerLimit.toString() + ' and ' + session.userData.upperLimit.toString()+ '.';
        // session.send(msg);
        session.say(msg, msg);
        //next();
    });

intents.matches('RandomNumber', [
    function (session, args, next) {
        var ranges = builder.EntityRecognizer.findAllEntities(args.entities, 'builtin.number');
        if (ranges.length > 0) {
            console.log('ranges:', ranges);
            setLimits(session, ranges);
        }
        var val = Math.trunc(Math.random() * session.userData.upperLimit) + session.userData.lowerLimit;
        session.userData.randomNumber = val;
        next();
    },
    function (session, results) {
        var msg = session.userData.randomNumber.toString();
        // session.send(msg);
        session.say(msg, msg);
    }
]);

intents.matches('RangeQuery', [
    function (session, args, next) {
        var boundary = builder.EntityRecognizer.findEntity(args.entities, 'boundary');
        if (boundary) {
            if (boundary.entity == 'lower') {
                var msg = 'The lower limit is ' + session.userData.lowerLimit.toString();
                // session.send(msg);
                session.say(msg, msg);
            } else if (boundary.entity == 'upper') {
                var msg = 'The upper limit is ' + session.userData.upperLimit.toString();
                // session.send(msg);
                session.say(msg, msg);
            } else {
                var msg = 'I don\'t know what the boundary "' + boundary + '" is.';
                // session.send(msg);
                session.say(msg, msg);
            }
        } else {
            var msg = 'The range is between ' + session.userData.lowerLimit.toString() + ' and ' + session.userData.upperLimit.toString()+ '.';
            // session.send(msg);
            session.say(msg, msg);
        }
    }
]);

function setLimitRange(session, lower, upper) {
    if (lower === null || upper === null || lower === NaN || upper === NaN) {
        var msg = 'That was not a valid range limit.';
        // session.send(msg);
        session.say(msg, msg);
        return;
    }
    if (upper < lower) {
        upper = [lower, lower = upper][0];
    }
    if (lower > upper) {
        var msg = 'The lower limit of ' + lower.toString() + ' cannot be greater than the upper limit of ' + session.userData.upperLimit.toString() + '.';
        // session.send(msg);
        session.say(msg, msg);
    } else if (upper < lower) {
        let msg = 'The upper limit of ' + upper.toString() + ' cannot be greater than the lower limit of ' + session.userData.lowerLimit.toString() + '.';

    } else {
        session.userData.lowerLimit = lower;
        session.userData.upperLimit = upper;
        var msg = 'The range is now between ' + lower.toString() + ' and ' + upper.toString() + '.';
        // session.send(msg);
        session.say(msg, msg);
    }
}

function setLimits(session, ranges, boundary) {
    if (ranges) {
        if (ranges.length === 1 && boundary) {
            var limit = builder.EntityRecognizer.parseNumber(ranges[0].entity);
            if (boundary === 'lower') {
                setLimitRange(session, limit, session.userData.upperLimit);
            } else if (boundary === 'upper') {
                setLimitRange(session, session.userData.lowerLimit, limit);
            }
        } else if (ranges.length === 2) {
            var lower = builder.EntityRecognizer.parseNumber(ranges[0].entity);
            var upper = builder.EntityRecognizer.parseNumber(ranges[1].entity);
            setLimitRange(session, lower, upper);
        } else {
            setLimitRange(session, null, null);
        }
    }
}

intents.matches('SetRange', [
    function (session, args, next) {
        var boundary = builder.EntityRecognizer.findEntity(args.entities, 'boundary');
        var ranges = builder.EntityRecognizer.findAllEntities(args.entities, 'builtin.number');
        if (ranges) {
            setLimits(session, ranges, boundary ? boundary.entity : null);
        }
    }
]);

bot.dialog('/', intents);

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpoint at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = { default: connector.listen() }
}
