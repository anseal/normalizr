"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCallFrames = exports.deepEqualDiffShape = exports.deepEqualSameShape = exports.clonePojoGraph = exports.clonePojoTree = exports.deepEqualWithJSON = exports.cloneWithJSON = void 0;
function cloneWithJSON(data) {
    return JSON.parse(JSON.stringify(data));
}
exports.cloneWithJSON = cloneWithJSON;
function deepEqualWithJSON(data1, data2) {
    return JSON.stringify(data1) === JSON.stringify(data2);
}
exports.deepEqualWithJSON = deepEqualWithJSON;
function clonePojoTree(data) {
    if (Array.isArray(data)) {
        return data.map(clonePojoTree);
    }
    if (typeof data === 'object' && data !== null) {
        const copy = {};
        for (const key in data) {
            copy[key] = clonePojoTree(data[key]);
        }
        return copy;
    }
    return data;
}
exports.clonePojoTree = clonePojoTree;
function clonePojoGraph(data, cache = new Map()) {
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    const cached = cache.get(data);
    if (cached) {
        return cached;
    }
    if (Array.isArray(data)) {
        const res = new Array(data.length);
        cache.set(data, res);
        for (let i = 0; i !== data.length; ++i) {
            res[i] = clonePojoGraph(data[i], cache);
        }
        return res;
    }
    else {
        const res = Object.create(Object.getPrototypeOf(data));
        cache.set(data, res);
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                res[key] = clonePojoGraph(data[key], cache);
            }
        }
        return res;
    }
}
exports.clonePojoGraph = clonePojoGraph;
function deepEqualSameShape(data1, data2) {
    if (Array.isArray(data1)) {
        if (Array.isArray(data2) === false) {
            return false;
        }
        if (data1.length !== data2.length) {
            return false;
        }
        for (let i = 0; i !== data1.length; ++i) {
            if (deepEqualSameShape(data1[i], data2[i]) === false) {
                return false;
            }
        }
        return true;
    }
    if (typeof data1 === 'object') {
        if (typeof data2 !== 'object') {
            return false;
        }
        if (data1 === null) {
            if (data2 !== null) {
                return false;
            }
            return true;
        }
        const keys1 = Object.keys(data1);
        const keys2 = Object.keys(data2);
        if (keys1.length !== keys2.length)
            return false;
        for (let i = 0; i !== keys1.length; ++i) {
            if (keys1[i] !== keys2[i]) {
                return false;
            }
        }
        for (const key of keys1) {
            if (deepEqualSameShape(data1[key], data2[key]) === false) {
                return false;
            }
        }
        return true;
    }
    return data1 === data2 || Number.isNaN(data1) === Number.isNaN(data2);
}
exports.deepEqualSameShape = deepEqualSameShape;
function deepEqualDiffShape(data1, data2) {
    if (Array.isArray(data1)) {
        if (Array.isArray(data2) === false) {
            return false;
        }
        if (data1.length !== data2.length) {
            return false;
        }
        for (let i = 0; i !== data1.length; ++i) {
            if (deepEqualDiffShape(data1[i], data2[i]) === false) {
                return false;
            }
        }
        return true;
    }
    if (typeof data1 === 'object') {
        if (typeof data2 !== 'object') {
            return false;
        }
        if (data1 === null) {
            if (data2 !== null) {
                return false;
            }
            return true;
        }
        const keys1 = Object.keys(data1);
        const keys2 = Object.keys(data2);
        if (keys1.length !== keys2.length)
            return false;
        for (const key of keys1) {
            if (deepEqualDiffShape(data1[key], data2[key]) === false) {
                return false;
            }
        }
        return true;
    }
    return data1 === data2 || Number.isNaN(data1) === Number.isNaN(data2);
}
exports.deepEqualDiffShape = deepEqualDiffShape;
function getCallFrames(exclude) {
    const stack = new Error("").stack;
    if (!stack)
        return [];
    return (stack
        .split('\n')
        .slice(1 + exclude) // +1 to remove exception "header" - the 'Error: ...'
    // .map(frame => {
    // 	let matches = frame.match(/    at (.*?) \((.*):(.*?):(.*?)\)/)
    // 	if( matches === null ) matches = frame.match(/    at ()(.*):(.*?):(.*)/) // for global context?
    // 	if( matches === null ) matches = frame.match(/    at ()(.*)()()/) // for internals?
    // 	if( matches === null ) {
    // 		return {
    // 			functionName: 'unknown',
    // 			// scriptId: "8", // have no idea how to figure this one out
    // 			url: 'unknown',
    // 			lineNumber: 0,
    // 			columnNumber: 0,
    // 		}
    // 	}
    // 	const [_, functionName, url, lineNumber, columnNumber] = matches
    // 	// const [_, functionName, url, lineNumber, columnNumber] = frame.match(/    at (.*?)? \((.*):(.*?):(.*?)\)/)
    // 	return {
    // 		functionName,
    // 		// scriptId: "8", // have no idea how to figure this one out
    // 		url,
    // 		lineNumber: Number(lineNumber),
    // 		columnNumber: Number(columnNumber),
    // 	}
    // })
    );
}
exports.getCallFrames = getCallFrames;
//# sourceMappingURL=utils.js.map