const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Read and parse data JSON files. Events are:
 *
 * - error: An error occured while reading or parsing a file. The
 *          processing of other files continues. One arg is passed
 *          which is the error message as a string.
 *
 * - fatal: A fatal error occured like the directory is not readable
 *          or is empty or the file system is stalled and reading
 *          takes way too long.
 *
 * - ready: The processing of all the files finished. The event has
 *          one argument that is the list of JSON objects loaded from
 *          the files.
 *
 * Files reading is asynchronous. Event 'fileprocessed' is used
 * internally to keep track of the processed files.
 *
 * IMPORTANT: If the files loading lasts more than 5 seconds the 'fatal'
 * event is emitted as this is considered a bogus fs case. The timeout
 * could be adjusted as a program option to handle various volumes of data.
 */
class DataLoader extends EventEmitter {

    constructor(dir) {
        super();

        const self = this;

        this.dir = dir;

        // Cache for the files successfully loaded as JSONs
        this.cache = [];
        this.cacheReady = false;

        // Only core modules can be used so no async and similar so
        // just keep track of the files that have been processed to
        // know when it is done.
        this.filesToProcessCount = 0;
        this.filesProcessedCount = 0;

        /*jshint unused:false*/
        this.on('fileprocessed', (filePath, isSuccess, object) => {
            if(isSuccess) {
                self.cache.push(object);
            }

            this.filesProcessedCount += 1;

            if(self.filesToProcessCount === self.filesProcessedCount) {
                self.emit('ready', this.cache);
                clearTimeout(self.safety);
                self.cacheReady = true;
            }
        });
    }

    // Depending on a real use case assess if it wouldn't be wiser to just index
    // all the tags upfront and then just return occurences count from this so file
    // contents are actually processed only once.

    loadFiles() {

        if(this.cacheReady) {
            return this.emit('ready', this.cache);
        }

        const self = this;

        const dir = self.dir;

        // The loading should not take more than 5 seconds ...
        self.safety = setTimeout(function() {
            self.emit('fatal', 'Timeout for reading files reached');
        }, 5000);

        fs.readdir(self.dir, function(err, files) {
            if(err) {
                self.emit('fatal', util.format('Unable to load files from path %s: %s', dir, err));
            }

            if(!files || files.length < 1) {
                self.emit('fatal', util.format('No files found in data folder %s', dir));
            }

            self.filesToProcessCount = files.length;

            /*jshint loopfunc: true */
            for(const file of files) {
                setTimeout(function() {
                    const filePath = path.join(dir, file);

                    // Careful to emit fileprocessed in every code branch otherwise
                    // the ready event will never be emitted
                    fs.readFile(path.join(dir, file), function (err, data) {
                        if (err) {
                            self.emit('error', util.format("Error reading file '%s': %s", filePath, err));
                            self.emit('fileprocessed', filePath, false, null);
                            return;
                        }

                        try {
                            const obj = JSON.parse(data.toString('utf8'));
                            return self.emit('fileprocessed', filePath, true, obj);
                        } catch (e) {
                            self.emit('error', util.format("Error parsing file '%s': %s", filePath, e));
                            self.emit('fileprocessed', filePath, false, null);
                        }
                    });
                }, 0);
            }
        });
    }
}

module.exports = (dir) => new DataLoader(dir);