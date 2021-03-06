/*
 * @Author: zhuo.wu
 * @Date:   2016-01-26 15:20:05
 * @Last Modified by: baotong.wang
 * @Last Modified time: 2017-02-24 20:07:02
 */

'use strict';

var defaultOptions = {
    timeout: 5000,
    jsonpCallback: 'callback',
    jsonpCallbackFunction: null
};

function generateCallbackFunction() {
    return 'jsonp_' + Date.now() + '_' + Math.ceil(Math.random() * 100000);
}

// Known issue: Will throw 'Uncaught ReferenceError: callback_*** is not defined' error if request timeout
function clearFunction(functionName) {
    // IE8 throws an exception when you try to delete a property on window
    // http://stackoverflow.com/a/1824228/751089
    try {
        delete window[functionName];
    } catch (e) {
        window[functionName] = undefined;
    }
}

function removeScript(scriptId) {
    var script = document.getElementById(scriptId);
    document.getElementsByTagName('head')[0].removeChild(script);
}

var fetchJsonp = function fetchJsonp(url) {
    var options = arguments[1] === undefined ? {} : arguments[1];

    var timeout = options.timeout != null ? options.timeout : defaultOptions.timeout;
    var jsonpCallback = options.jsonpCallback != null ? options.jsonpCallback : defaultOptions.jsonpCallback;

    var timeoutId = undefined;

    return new Promise(function(resolve, reject) {
        var callbackFunction = options.jsonpCallbackFunction || generateCallbackFunction();

        window[callbackFunction] = function(response) {
            resolve({
                ok: true,
                // keep consistent with fetch API
                json: function json() {
                    return Promise.resolve(response);
                }
            });

            if (timeoutId) clearTimeout(timeoutId);

            removeScript(jsonpCallback + '_' + callbackFunction);

            clearFunction(callbackFunction);
        };

        // Check if the user set their own params, and if not add a ? to start a list of params
        url += url.indexOf('?') === -1 ? '?' : '&';

        var jsonpScript = document.createElement('script');
        jsonpScript.setAttribute('src', url + jsonpCallback + '=' + callbackFunction);
        jsonpScript.id = jsonpCallback + '_' + callbackFunction;
        document.getElementsByTagName('head')[0].appendChild(jsonpScript);

        timeoutId = setTimeout(function() {
            reject(new Error('JSONP request to ' + url + ' timed out'));

            clearFunction(callbackFunction);
            removeScript(jsonpCallback + '_' + callbackFunction);
        }, timeout);
    });
};


if (typeof window !== 'undefined') {
    window.fetchJsonp = fetchJsonp;
}

module.exports = fetchJsonp;