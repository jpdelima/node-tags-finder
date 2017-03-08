const readline = require('readline');
const fs = require('fs');
const path = require('path');
const util = require('util');
const config = require('./config');

let defaultTags; // Cache for default tags once read

// Remove input tags duplicates, empty values and trim the tags
function sanitizeTags(inputTags) {

    if(!inputTags) {
        return [];
    }

    let uniqueTags = Array.from(new Set(inputTags));

    uniqueTags = uniqueTags.reduce(function(acc, item) {
        const trimmed = item.trim();
        if(trimmed !== '') {
            acc.push(trimmed);
        }
        return acc;
    }, []);

    return uniqueTags;
}

// Sanitize input from CLI or load default tags
function processInputTags(inputTags, cb) {

    const sanitizedTags = sanitizeTags(inputTags);

    if(sanitizedTags && sanitizedTags.length > 0) {
        return cb(null, sanitizedTags);
    }

    if(defaultTags) {
        return cb(null, defaultTags);
    }

    const defaultTagsFilePath = path.join(__dirname, config.defaultTagsFile);

    try {
        fs.readFile(defaultTagsFilePath, function (err, data) {
            if (err) {
                return cb(util.format("Unable to read default tags file '%s': %s", defaultTagsFilePath, err));
            }

            const fileInputTags = data && data.toString().split('\n');

            const sanitizedDefaultTags = sanitizeTags(fileInputTags);

            if(!sanitizedDefaultTags || sanitizedDefaultTags.length < 0) {
                return cb(util.format("Empty default tags file '%s'", defaultTagsFilePath));
            }

            defaultTags = sanitizedDefaultTags; // cache

            return cb(null, sanitizedDefaultTags);
        });
    } catch(e) {
        return cb(util.format("Unexpected error while reading default tags file '%s'", defaultTagsFilePath, e));
    }
}

function prompt(message) {
    process.stdout.write('\n');
    process.stdout.write(message || 'Type your comma separated list of tags:');
    process.stdout.write('\n\> ');
}

const cli = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const tagsFinder = require('./tagsfinder')();

const jsonLoader = require('./dataloader')(path.join(__dirname, config.dataFolder));

jsonLoader.on('error', function(message) {
    console.error(message);
});

jsonLoader.on('fatal', function(message) {
    console.error(message);
    console.error('Fatal error. Exiting program!');
    process.exit(1);
});

jsonLoader.on('ready', function(objects) {
    tagsFinder.setData(objects);
    prompt();
});

cli.on('error', (message) => {
    console.error(message);
    prompt();
});

cli.on('ready', (tags) => {

    try {
        const results = tagsFinder.process(tags);

        for (const result of results) {
            console.log("%s\t%d", result.tag, result.count);
        }
    } catch (e) {
        console.error(e);
    }

    prompt();
});

cli.on('line', (inputLine) => {

    let cliInputTags = inputLine && inputLine.split(',');

    processInputTags(cliInputTags, function(err, finalTags) {
        if(err) {
            return cli.emit('error', err);
        }

        return cli.emit('ready', finalTags);
    });
});

process.on('uncaughtException', function(err) {
    console.error('Oops ... An unexpected error occured!', err);
    console.error('Closing the program');
    process.exit(1);
});

jsonLoader.loadFiles();
