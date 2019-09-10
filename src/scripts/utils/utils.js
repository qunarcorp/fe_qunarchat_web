/*
 * @Author: baotong.wang 
 * @Date: 2017-02-10 18:09:23 
 * @Last Modified by: baotong.wang
 * @Last Modified time: 2017-11-06 20:59:57
 */

'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var utils = {
    getCookie: function(key, isDecode) {
        var cookies = document.cookie ? document.cookie.split('; ') : [];
        var ret = null;

        for (var i = 0, l = cookies.length, cookie; i < l; i++) {
            cookie = cookies[i].split('=');
            if (key == cookie[0]) {
                ret = isDecode ? decodeURIComponent(cookie[1]) : cookie[1];
                break;
            }
        }

        return ret;
    },
    isArray: function(arr) {
        if (typeof Array.isArray === 'function') {
            return Array.isArray(arr);
        }

        return toStr.call(arr) === '[object Array]';
    },
    isPlainObject: function(obj) {
        if(!obj || toStr.call(obj) !== '[object Object]') {
            return false;
        }

        var hasOwnConstructor = hasOwn.call(obj, 'constructor');
        var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
        // Not own constructor property must be Object
        if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
            return false;
        }

        // Own properties are enumerated firstly, so to speed up,
        // if last one is own, then all properties are own.
        var key;
        for (key in obj) { /**/ }

        return typeof key === 'undefined' || hasOwn.call(obj, key);
    },
    extend: function() {
        var options, name, src, copy, copyIsArray, clone;
        var target = arguments[0];
        var i = 1;
        var length = arguments.length;
        var deep = false;

        // Handle a deep copy situation
        if (typeof target === 'boolean') {
            deep = target;
            target = arguments[1] || {};
            // skip the boolean and the target
            i = 2;
        } else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
            target = {};
        }

        for (; i < length; ++i) {
            options = arguments[i];
            // Only deal with non-null/undefined values
            if (options != null) {
                // Extend the base object
                for (name in options) {
                    src = target[name];
                    copy = options[name];

                    // Prevent never-ending loop
                    if (target !== copy) {
                        // Recurse if we're merging plain objects or arrays
                        if (deep && copy && (this.isPlainObject(copy) || (copyIsArray = this.isArray(copy)))) {
                            if (copyIsArray) {
                                copyIsArray = false;
                                clone = src && this.isArray(src) ? src : [];
                            } else {
                                clone = src && this.isPlainObject(src) ? src : {};
                            }

                            // Never move original objects, clone them
                            target[name] = this.extend(deep, clone, copy);

                            // Don't bring in undefined values
                        } else if (typeof copy !== 'undefined') {
                            target[name] = copy;
                        }
                    }
                }
            }
        }

        // Return the modified object
        return target;
    },
    /* 生成唯一标识 */
    createUUID: function() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
        });
        return uuid.toUpperCase();
    },
    // 字节变为兆
    bytesToMB: function(bytes) {
        if (bytes === 0) return '1';

        var m = 1024 * 1024;

        var result = Math.floor(bytes / m);
        if (result < 1) { //如果小于1都为1
            result = 1;
        }

        return result;
    },

    bytesToSize: function(bytes) {
        if (bytes === 0) return '0 B';

        var k = 1024;

        var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        var i = Math.floor(Math.log(bytes) / Math.log(k));

        return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
        //toPrecision(3) 后面保留一位小数，如1.0GB                                                                                                                  //return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
    },
    getEmptyFunc: function() {
        console.log(arguments);
    },
    isSupportWebSocket: function() {
        if (!!window.WebSocket && window.WebSocket.prototype.send) {
            return true;
        }

        return false;
    },
    updateQueryString: function(url, key, value) {
        var parts = url.split('#'),
            uri = parts.shift(),
            hash = '',
            re = new RegExp('([?&])' + key + '=.*?(&|$)', 'i'),
            separator = uri.indexOf('?') !== -1 ? '&' : '?';

        if(parts.length) {
            hash = '#' + parts.join('#');
        }

        if (uri.match(re)) {
            return uri.replace(re, '$1' + key + '=' + value + '$2') + hash;
        } else {
            return uri + separator + encodeURIComponent(key) + '=' + encodeURIComponent(value) + hash;
        }
    },
};

module.exports = utils;