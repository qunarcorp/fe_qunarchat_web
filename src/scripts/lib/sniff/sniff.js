/*
 * @Author:  heng.xu
 * @Date:  2015/11/25
 * @Last Modified by:
 * @Last Modified time:
 * @Description  版本检查
 */

var utils = require('utils/utils.js');

var sniff = {}; // 结果
var FALSE = false;
var TRUE = true;

var ua = navigator.userAgent,
    platform = navigator.platform,
    android = ua.match(/(Android);?[\s\/]+([\d.]+)?/),  // 匹配 android
    ipad = ua.match(/(iPad).*OS\s([\d_]+)/),            // 匹配 ipad
    ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/),         // 匹配 ipod
    iphone = ua.match(/(iPhone\sOS)\s([\d_]+)/);        // 匹配 iphone

sniff.ios = sniff.android = sniff.iphone = sniff.ipad = sniff.ipod = FALSE;

// Android
if (android) {
    sniff.os = 'android';
    sniff.osVersion = android[2];
    sniff.android = TRUE;
}

// IOS
if (ipad || iphone || ipod) {
    sniff.os = 'ios';
    sniff.ios = TRUE;
}

if (iphone) {
    sniff.osVersion = iphone[2].replace(/_/g, '.');
    sniff.iphone = TRUE;
    sniff.imobile = TRUE;
}

if (ipad) {
    sniff.osVersion = ipad[2].replace(/_/g, '.');
    sniff.ipad = TRUE;
}

if (ipod) {
    sniff.osVersion = ipod[3] ? ipod[3].replace(/_/g, '.') : NULL;
    sniff.ipod = TRUE;
    sniff.imobile = TRUE;
}

// iOS 8+ changed UA
if (sniff.ios && sniff.osVersion && ua.indexOf('Version/') >= 0) {
    if (sniff.osVersion.split('.')[0] === '10') {
        sniff.osVersion = ua.toLowerCase().split('version/')[1].split(' ')[0];
    }
}

if (sniff.osVersion) {
    sniff.osVersion = parseInt(sniff.osVersion.match(/\d+\.?\d*/)[0]);
}

// Pixel Ratio
sniff.pixelRatio = window.devicePixelRatio || 1;

sniff.retina = sniff.pixelRatio >= 2;

sniff.pc = platform.indexOf('Mac') === 0 || platform.indexOf('Win') === 0 || (platform.indexOf('linux') === 0 && !sniff.android);
sniff.qunar = false;

module.exports = sniff;