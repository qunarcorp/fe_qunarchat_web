/*
 * @Author: baotong.wang
 * @Date: 2017-02-17 18:48:23
 * @Last Modified by: baotong.wang
 * @Last Modified time: 2017-06-28 12:29:08
 * @Description: qchat特殊消息的转义，比如表情、图片、文件
 */

require('lib/extension/string.js');
var enums = require('../enums.js');
var utils = require('utils/utils.js');
var domain = window.nav_igator.baseaddess.fileurl;

var messageHelper = {
    setOptions: function(emotions) {
        this.emotions = emotions;
        this.prefixFunc = [this.emotions.prefix];
        this.$virtualDom = $('<div></div>');

        this.pattern = /\[(.*?)\|(.*?)\]/;
        this.urlPattern = /\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<]{2,200}\b/g;
    },
    encode: function(content) {
        // 过了image、file、表情
        if(this.pattern.test(content)) {
            var type = RegExp.$1,
                val = RegExp.$2;

            content = content.replace(this.pattern, '[obj type="{0}" value="{1}"]'.format(type, val));
        }

        for (var i = 0; i < this.prefixFunc.length; i++) {
            content = this.prefixFunc[i].call(null, content);
        }

        // 输入内容包含url时编码
        var list = content.match(this.urlPattern);

        if (list) {
            for (var i = 0; i < list.length; i++) {
                var prot = list[i].indexOf('http://') === 0 || list[i].indexOf('https://') === 0 ? '' : 'http://';
                var escaped_url = encodeURI(decodeURI(list[i])).replace(/[!'()]/g, escape).replace(/\*/g, '%2A');

                content = content.replace(list[i], '[obj type="url" value="' + prot + escaped_url + '"]');
            }
        }

        // 输入内容为html标签是编码，不允许传输标签
        content = content.replace(/&nbsp;/g, ' ');
        content = content.replace(/(<[^>]*>)/g, function($0, $1) {
            if (/<img[^>]*>/gi.test($1)) {
                return $1;
            } else if(/<[/]?div>/gi.test($1)) {
                return $1;
            } else {
                return '';
            }
        });

        return content;
    },
    decode: function(content, msgType) {
        var self = this;

        if (msgType == enums.MsgTypes.FILE) {
            var file = JSON.parse(content);
            var fileName = file.FileName;

            // 兼容老接口的地址需要加上域名
            var serverUrl = (file.HttpUrl.indexOf('cgi-bin') > -1 ? domain : '') + file.HttpUrl;
            var ret = '[file|{0}|{1}]'.format(serverUrl, fileName);
            // 文件都是单行数据

            return ret;
            // return '文件：<a href="{0}" style="text-decoration:underline;" title="下载文件">{1}</a>'.format(serverUrl, fileName);
        }

        var re = /\[obj type=\"(.*?)\" value=\"\[?(.*?)\]?\"( width=(.*?) height=(.*?))?.*?\]/g;

        content = content.replace(re, function() {
            if (arguments && arguments.length > 2) {
                var ret = arguments[0];
                var type = arguments[1],
                    val = arguments[2],
                    width = arguments[4];

                switch (type) {
                    case 'image':
                        if(val.indexOf('http') === -1) {
                            val = window.nav_igator.baseaddess.fileurl + val;
                        }

                        ret = '[image|' + (val.indexOf('cgi-bin') > -1 ? (domain + val) : val) + ']';
                        break;
                    case 'emoticon':
                        var emotion = self.emotions.getServerUrl(val, width);

                        ret = emotion ? '[emoticon|{0}|{1}]'.format(emotion.url, emotion.title) : '';
                        break;
                    case 'url':
                        ret = '[url|{0}]'.format(val);
                        // ret = '<a href="{0}" title="打开网址" style="text-decoration:underline;" target="_blank">{0}</a>'.format(arguments[2]);
                        break;
                }

                return ret;
            }
        });

        return content;
    },
    // 预处理发送图片消息，处理外部传入的imageSrc
    prefixImageMsg: function(imageSrc) {
        var msg = '[obj type="image" value="{0}" width={1} height={2} ]';
        var deffered = $.Deferred();
        var isLoaded = false;
        var localImg = new Image();

        localImg.src = imageSrc;

        localImg.onload = function() {
            isLoaded = true;

            var ret = {
                ret: true,
                data: msg.format(imageSrc, localImg.width, localImg.height)
            };

            deffered.resolve(ret);
        };

        // 如果一秒钟之内没加载完，发送默认尺寸
        setTimeout(function() {
            if(isLoaded) {
                return;
            }

            isLoaded = true;

            var ret = {
                ret: true,
                data: msg.format(imageSrc, 200, 200)
            };

            deffered.resolve(ret);
        }, 1000);

        return deffered;
    },
    // 预处理发送文件消息，处理外部传入的fileSrc
    prefixFileMsg: function(fileName, fileSize, fileSrc) {
        var fileData = {
            FILEID: new Date().getTime(),
            FILEMD5: '123',
            FileName: fileName,
            FileSize: utils.bytesToSize(fileSize),
            HttpUrl: fileSrc
        };

        return JSON.stringify(fileData);
    }
};

module.exports = messageHelper;
