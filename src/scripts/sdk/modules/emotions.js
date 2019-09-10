/*
 * @Author: baotong.wang
 * @Date: 2017-02-17 19:34:25
 * @Last Modified by: baotong.wang
 * @Last Modified time: 2017-05-22 16:35:06
 * @Description: 表情管理
 */

require('lib/extension/string.js');
var emotions = require('lib/emotions/emotions.js');


var config = {
    // 默认支持的表情包 - 兼容web端
    // 如果是从客户端过来的表情，一般情况下都指定了表情包是啥
    category: 'EmojiOne'
};

var initCategory;

var Emotions = function(domain) {
    this.domain = domain;
    this.serverFolder = domain + '/file/v1/emo/d/e/{0}/{1}/fixed';
};

Emotions.prototype.getEmotionsList = function(options) {
    var faces, server;

    switch(options.bu_name) {
        case 'callcenter':
            faces = emotions.smallCamelEmotions.FACESETTING.DEFAULTFACE;
            break;
        default:
            // 这个文件的服务器地址都切为新的，为了保持兼容这里hack一下新的库name
            faces = emotions.emotions[0].FACESETTING.DEFAULTFACE;
            faces['-categery'] = 'EmojiOne';
            break;
    }

    this.faces = faces;
    initCategory = faces['-categery'];
    server = this.serverFolder + faces['-categery'] + '/';

    var list = {
        count: faces['-count'],
        category: faces['-categery'],
        items: []
    };

    for (var i = 0, face, item; i < faces.FACE.length; i++) {
        face = faces.FACE[i];

        item = {
            tip: face['-tip'],
            img: this.serverFolder.format(list.category, face['-shortcut']),
            shortcut: face['-shortcut']
        };

        list.items.push(item);
    }

    return list;
};

Emotions.prototype.prefix = function(content) {
    // var pattern = //;
    var pattern = /<(?:img|IMG) .*?(shortcut|data-emoticon)=\"(.*?)\".*?>/g;
    var emoticons = content.match(pattern);

    if (emoticons) {
        for (var i = 0; i < emoticons.length; i++) {
            var str = emoticons[i].replace(pattern, function() {
                if (arguments && arguments.length > 1) {
                    return '[obj type="emoticon" value="[' + arguments[2] + ']" width=' + initCategory + ' height=0 ]';
                }
            });

            content = content.replace(emoticons[i], str);
        }
    }

    return content;
};

Emotions.prototype.getServerUrl = function(shortcut, category) {
    if (!shortcut || shortcut.length == 0) {
        return null;
    }

    var faceCategory = category || config.category;

    return {
        url: '{0}file/v1/emo/d/e/{1}/{2}/fixed'.format(this.domain, faceCategory, shortcut.replace('/', '')),
        title: ''
    };

    // var shortcutName = shortcut.slice(1, shortcutName.length - 1);
    // var shortcutName = shortcut;
    // for (var i = 0; i < emotions.emotions.length; i++) {
    //     var obj = emotions.emotions[i];
    //     var NS = obj.FACESETTING.DEFAULTFACE['-categery'];
    //     var faces = obj.FACESETTING.DEFAULTFACE.FACE;
    //     var hasMatch = false;

    //     if(!category || NS.indexOf(category) > -1) {
    //         for (var j = 0; j < faces.length; j++) {
    //             if (faces[j]['-shortcut'] === shortcut || faces[j]['-shortcut'] === shortcutName) {
    //                 hasMatch = true;
    //                 return {
    //                     url: this.serverFolder + NS + '/' + faces[j]['FILE_ORG'],
    //                     title: faces[j]['-tip']
    //                 }
    //             }
    //         }
    //     }

    //     if(!hasMatch) {
    //         return {
    //             url: '{0}file/v1/emo/d/e/{1}/{2}/fixed'.format(this.domain, category, shortcut.replace('/', '')),
    //             title: ''
    //         }
    //     }
    // }

    // return null;
};

module.exports = Emotions;
