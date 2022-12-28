
/**
 * path iterator
 * @param {string} path 
 */
const pathIterator = function* (path) {
    let leadingChar = "."
    while (true) {
        const nextAt = path.search(/[.\[]/g)
        if (nextAt < 0) {
            break
        }
        if (leadingChar === "[") {
            const part = Number.parseInt(path.substring(0, nextAt - 1))
            yield part
        } else {
            const part = path.substring(0, nextAt)
            if (part.length > 0) {
                yield part
            }
        }
        // console.log(leadingChar, part)
        leadingChar = path.substring(nextAt, nextAt + 1)
        path = path.substring(nextAt + 1)
    }
    if (path.length > 0) {
        if (leadingChar === "[") {
            const part = Number.parseInt(path.substring(0, path.length - 1))
            yield part
        } else {
            const part = path.substring(0, path.length)
            if (part.length > 0) {
                yield part
            }
        }
    }
}

/**
 * Get value in plain object, return defaultValue if not found
 * @param {any} obj 
 * @param {string} path 
 * @param {any} defaultValue 
 * @return {any}
 */
const objectGet = (obj, path, defaultValue = undefined) => {
    let currentObj = obj
    for (const part of pathIterator(path)) {
        if (Object.prototype.hasOwnProperty.call(currentObj, part)) {
            currentObj = currentObj[part]
        } else {
            return defaultValue
        }
    }
    return currentObj
}

/**
 * Set value in plain object, return true if successful
 * @param {any} obj 
 * @param {string} path 
 * @param {any} value 
 * @return {boolean}
 */
const objectSet = (obj, path, value) => {
    let currentObj = obj
    let lastObj = undefined
    let lastKey = undefined
    for (const part of pathIterator(path)) {
        if (Object.prototype.hasOwnProperty.call(currentObj, part)) {
            lastObj = currentObj
            lastKey = part
            currentObj = currentObj[part]
        } else {
            return false
        }
    }
    if (lastObj !== undefined && lastKey !== undefined) {
        lastObj[lastKey] = value
        return true
    }
    return false
}

if (import.meta.main) {
    console.log("==== Program Start ====");
    const obj = {
        a: {
            b: "text",
            c: [ "e", "f" ],
        },
        d: [
            {
                e: "Hello",
            },
            {
                f: [ "dragon", "wyvern", "kobold" ],
            },
            [ "0", "1", "2", "3" ],
        ],
    };
    console.log(objectSet(obj, "d[1].f[0]", ["pet"]))
    const value = objectGet(obj, "d[1].f[0]")
    console.log(value)
}
