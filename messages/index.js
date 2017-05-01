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
        session.send('Sorry, I did not understand \'%s\'.', session.message.text);
    })
    .onBegin(function (session, args, next) {
        session.userData.lowerLimit = 1;
        session.userData.upperLimit = 100;
        session.send('I can give you a random number between %d and %d.', session.userData.lowerLimit, session.userData.upperLimit);
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
        session.send(session.userData.randomNumber.toString());
    }
]);

intents.matches('RangeQuery', [
    function (session, args, next) {
        var boundary = builder.EntityRecognizer.findEntity(args.entities, 'boundary');
        if (boundary) {
            if (boundary.entity == 'lower') {
                session.send('The lower limit is ' + session.userData.lowerLimit.toString());
            } else if (boundary.entity == 'upper') {
                session.send('The upper limit is ' + session.userData.upperLimit.toString());
            } else {
                session.send('I don\'t know what the boundary "' + boundary + '" is.');
            }
        } else {
            session.send('The range is between %d and %d.', session.userData.lowerLimit, session.userData.upperLimit);
        }
    }
]);

function setLimitRange(session, lower, upper) {
    if (lower === null || upper === null || lower === NaN || upper === NaN) {
        session.send('That was not a valid range limit.');
        return;
    }
    if (upper < lower) {
        upper = [lower, lower = upper][0];
    }
    if (lower > upper) {
        session.send('The lower limit of ' + lower.toString() + ' cannot be greater than the upper limit of ' + session.userData.upperLimit.toString() + '.');
    } else if (upper < lower) {
        session.send('The upper limit of ' + upper.toString() + ' cannot be greater than the lower limit of ' + session.userData.lowerLimit.toString() + '.');
    } else {
        session.userData.lowerLimit = lower;
        session.userData.upperLimit = upper;
        session.send('The range is now between ' + lower.toString() + ' and ' + upper.toString() + '.');
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
