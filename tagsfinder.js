/**
 *  Find tags in a set of JSON objects. All functions are synchronous.
 *
 *  Tags are only searched in object properties called 'tags' and that
 *  are of type array.
 *
 *  If a tag is found twice or more in the same array it is counted only
 *  once (arbitrary choice).
 *
 *  Results for already found tags are cached.
 *
 *  Tags passed to the 'process' method are expected to be sanitized
 *  already (no duplicate or empty tags).
 *
 *  Nested objects or arrays of objects are supported using recursion.
 *  We make the assumption that the objects volume will not make the call
 *  stack explode because of the recursion.
 */
class TagsFinder {

    constructor() {
        this.cache = {};
    }

    // Set the list of JSON objects to lookup tags into
    setData(data) {
        if(!data || !Array.isArray(data)) {
            throw new Error('TagsFinder invalid data object');
        }

        this.data = data;
    }

    process(tags) {
        if(!this.data) {
            throw new Error('TagsFinder process called without data set');
        }

        let tmpResults = {}; // Object is easier to fill in
        let results = []; // Method result as an array to allow sorting

        let tagsToProcess = [];

        // used cached values for tags previously looked up
        for(const tag of tags) {
            if(this.cache[tag]) {
                results.push({ tag: tag, count: this.cache[tag]});
            } else {
                tagsToProcess.push(tag);
                tmpResults[tag] = 0;
            }
        }

        // lookup tags
        for(const obj of this.data) {
            this._processObject(tagsToProcess, obj, tmpResults);
        }

        // cache and sort results
        for(const tag of tagsToProcess) {
            this.cache[tag] = tmpResults[tag];
            results.push({ tag: tag, count: tmpResults[tag]});
        }

        results.sort(function(a, b) { return a.count < b.count; });

        return results;
    }

    _processObject(tags, obj, results) {
        for(var key in obj){
            if(obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'object') {
                    this._processObject(tags, obj[key], results);
                } else if (Array.isArray(obj[key])) {
                    for (const child of obj[key]) {
                        this._processObject(tags, child, results);
                    }
                } else if (typeof obj[key] === 'string') {
                    for(const tag of tags) {
                        if(obj[key].indexOf(tag) > -1) {
                            results[tag] += 1;
                        }
                    }
                }
            }
        }
    }
}

module.exports = () => new TagsFinder();