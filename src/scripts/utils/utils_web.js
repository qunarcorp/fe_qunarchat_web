(function (root, factory) {

    require('lib/extension/string.js');
    var emotions = require("emotions/emotions.js").emotions,
        utils = factory(jQuery, emotions);

    module.exports = {
        utils: utils
    }
}(this, function ($, emotions) {
    "use strict";
    var _range;

    $.expr[':'].emptyVal = function (obj) {
        return obj.value === '';
    };

    $.fn.hasScrollBar = function () {
        if (!$.contains(document, this.get(0))) {
            return false;
        }
        if (this.parent().height() < this.get(0).scrollHeight) {
            return true;
        }
        return false;
    };

    Date.prototype.format1 = function (format) {
        var o = {
            "M+": this.getMonth() + 1, //month
            "d+": this.getDate(), //day
            "h+": this.getHours(), //hour
            "m+": this.getMinutes(), //minute
            "s+": this.getSeconds(), //second
            "q+": Math.floor((this.getMonth() + 3) / 3), //quarter
            "S": this.getMilliseconds() //millisecond
        }

        if (/(y+)/.test(format)) {
            format = format.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
        }

        for (var k in o) {
            if (new RegExp("(" + k + ")").test(format)) {
                format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length));
            }
        }
        return format;
    };
    $.fn.addFileLinks = function (down_url) {
        if (this.length > 0) {
            this.each(function (i, obj) {
                var text = $(obj).html();
                try {
                    var jsonVal = eval('(' + text + ')');

                    var fileName = jsonVal.FileName;
                    var httpUrl = jsonVal.HttpUrl;
                    //兼容老接口的地址需要加上域名
                    if (httpUrl.indexOf("cgi-bin") > -1 && httpUrl.indexOf("http") === -1) {
                        httpUrl = down_url + jsonVal.HttpUrl;
                    }

                    $(obj).html('文件：<a target="_blank" href="{0}" style="text-decoration:underline;" title=下载文件>{1}</a>'.format(httpUrl, fileName));
                } catch (e) {
                    console.log(text);
                }
            });
        }
        return this;
    };
    $.fn.typeSet = function (down_url) {
        var re = /\[obj type=\"(.*?)\" value=\"\[?(.*?)\]?\"( width=(.*?) height=(.*?))?.*?\]/g;

        if (this.length > 0) {
            this.each(function (i, obj) {
                var text = $(obj).html();
                text = text.replace(re, function () {
                    var ret = arguments[0];
                    var type = arguments[1],
                        val = arguments[2],
                        width = arguments[4];

                    switch (type) {
                        case 'image':
                            var httpUrl = val;
                            if (httpUrl.indexOf('http') === -1) {
                                httpUrl = window.nav_igator.baseaddess.fileurl + '/' + httpUrl;
                            }

                            ret = '<img src="' + httpUrl + '"/>'
                            //兼容老接口的地址需要加上域名
                            if (httpUrl.indexOf("cgi-bin") > -1 && httpUrl.indexOf("http") === -1) {
                                ret = '<img src="' + down_url + httpUrl + '"/>'
                            }
                            break;
                        case 'emoticon':
                            // width 这里指的是表情包的category
                            ret = '<img src="{0}" title="{1}"/>'.format(utils.getEmoticonsUrl(down_url, val, width), val);
                            break;
                        case 'url':
                            ret = '<a target="_blank" href="{0}" title="打开网址" style="text-decoration:underline;">{0}</a>'.format(val);
                            break;
                    }

                    return ret;

                    // if (arguments && arguments.length > 2) {
                    //     if (arguments[1] === "image") {
                    //         var httpUrl = arguments[2];
                    //         if (httpUrl.indexOf('http') === -1) {
                    //             httpUrl = '' + httpUrl;
                    //         }

                    //         var imgObj = '<img src="' + httpUrl + '"/>'
                    //             //兼容老接口的地址需要加上域名
                    //         if (httpUrl.indexOf("cgi-bin") > -1) {
                    //             imgObj = '<img src="' + down_url + httpUrl + '"/>'
                    //         }
                    //         return imgObj;
                    //     } else if (arguments[1] === "emoticon") {
                    //         return '<img src="' + utils.getEmoticonsUrl(arguments[2], down_url + "webchat/emotions/") + '" title="' + arguments[2] + '"/>';
                    //     } else if (arguments[1] === "url") {
                    //         return '<a href="' + arguments[2] + '" title="' + "打开网址" + '" style="text-decoration:underline;" target="_blank">' + arguments[2] + '</a>'
                    //     } else {
                    //         return arguments[0];
                    //     }
                    // }
                });
                $(obj).html(text);
            });
        }
        return this;
    }

    var utils = {

        //字节变为兆
        bytesToMB: function (bytes) {
            if (bytes === 0) return '1';

            var m = 1024 * 1024;

            var result = Math.floor(bytes / m);
            if (result < 1) { //如果小于1都为1
                result = 1;
            }

            return result;
        },

        bytesToSize: function (bytes) {
            if (bytes === 0) return '0 B';

            var k = 1024;

            var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

            var i = Math.floor(Math.log(bytes) / Math.log(k));

            return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
            //toPrecision(3) 后面保留一位小数，如1.0GB                                                                                                                  //return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
        },
        getEmoticonsUrl: function (domain, shortcut, category) {
            if (!shortcut || shortcut.length == 0) {
                return "";
            }

            if (domain[domain.length - 1] !== '/') {
                domain += '/'
            }

            // 默认的web端表情集
            var faceCategory = category || 'EmojiOne';
            var url = '{0}file/v1/emo/d/e/{1}/{2}/fixed'.format(domain, faceCategory, shortcut.replace('/', ''));
            return url;
        },
        showEmoticons: function (serverUrl) {
            // serverUrl += "webchat/emotions/";
            var ulStr = '<ul>';
            var NS, width, height, faces, len, faceUrl, shortcut;

            if (serverUrl[serverUrl.length - 1] !== '/') {
                serverUrl += '/'
            }

            for (var i = 0, set, df; i < emotions.length; i++) {
                set = emotions[i];
                df = set.FACESETTING.DEFAULTFACE;

                NS = df['categoryNew'] || d["-categery"];
                width = df["-width"];
                height = df["-height"];
                faces = df.FACE;
                len = faces.length;

                for (var j = 0; j < len; j++) {
                    shortcut = faces[j]["-shortcut"];
                    faceUrl = '{0}file/v1/emo/d/e/{1}/{2}/fixed'.format(serverUrl, NS, shortcut.replace('/', ''));
                    ulStr += '<li><img src="{0}" data-emoticon="{1}"/></li>'.format(faceUrl, shortcut);
                }

                ulStr += '</ul>';
            }

            return ulStr;
        },
        replaceUrl: function (content) {
            var re = /<(img|IMG) src=\"(.*?)\" data-emoticon=\"(.*?)\">/g;
            var emoticons = content.match(re);
            if (emoticons) {
                for (var i = 0; i < emoticons.length; i++) {
                    var str = emoticons[i].replace(re, function () {
                        if (arguments && arguments.length > 2) {
                            return '[obj type="emoticon" value="[' + arguments[3] + ']"]'
                        }
                    });
                    content = content.replace(emoticons[i], str);
                }
            }
            var list = content.match(/\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<]{2,200}\b/g);
            if (list) {
                for (var i = 0; i < list.length; i++) {
                    var prot = list[i].indexOf('http://') === 0 || list[i].indexOf('https://') === 0 ? '' : 'http://';
                    var escaped_url = encodeURI(decodeURI(list[i])).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                    content = content.replace(list[i], '[obj type="url" value="' + prot + escaped_url + '"]');
                }
            }
            content = content.replace(/&nbsp;/g, " ");
            content = content.replace(/(<[^>]*>)/g, function ($0, $1) {
                if (/<img[^>]*>/gi.test($1)) {
                    return $1;
                } else {
                    return "";
                }
            });

            return content;
        },

        saveRange: function (el) {
            var selection = window.getSelection ? window.getSelection() : document.selection;
            var range = selection.createRange ? selection.createRange() : selection.getRangeAt(0);
            _range = range;
            if (!window.getSelection) {
                var o = el;
                if (o.lastChild && o.lastChild.tagName == "IMG") {
                    o.appendChild(document.createTextNode("\n"));
                }
            }
        },

        //锁定编辑器中鼠标光标位置。。
        insertimg: function (str, el) {
            el.focus();
            if (!_range) {
                this.saveRange();
            }
            if (!window.getSelection) {
                var range = _range;
                range.pasteHTML(str);
                range.collapse(false);
                range.select();
            } else {
                var selection = window.getSelection ? window.getSelection() : document.selection;
                var range = _range;
                range.collapse(false);
                var hasR = range.createContextualFragment(str);
                var hasR_lastChild = hasR.lastChild;
                while (hasR_lastChild && hasR_lastChild.nodeName.toLowerCase() == "br" && hasR_lastChild.previousSibling && hasR_lastChild.previousSibling.nodeName.toLowerCase() == "br") {
                    var e = hasR_lastChild;
                    hasR_lastChild = hasR_lastChild.previousSibling;
                    hasR.removeChild(e)
                }
                range.insertNode(hasR);
                if (hasR_lastChild) {
                    range.setEndAfter(hasR_lastChild);
                    range.setStartAfter(hasR_lastChild)
                }
                selection.removeAllRanges();
                selection.addRange(range)
            }
        },

        pasteHandler: function (el, event) {
            var self = this;
            setTimeout(function () {
                var content = el.innerHTML;
                content = content.replace(/(<[^>]*>)/g, function ($0, $1) {
                    if (/<img[^>]*>/gi.test($1)) {
                        return $1;
                    } else {
                        return "";
                    }
                });

                el.innerHTML = content;
                self.saveRange();
            }, 1)
        },

        /* 生成唯一标识 */
        createUUID: function () {
            var d = new Date().getTime();
            var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
            });
            return uuid.toUpperCase();
        },

        /*
         * 特殊字符转换为Html标签
         */
        escape2Html: function (str) {
            if (!str) {
                return "";
            }
            var arrEntities = {
                'lt': '<',
                'gt': '>',
                'nbsp': ' ',
                'amp': '&',
                'quot': '"'
            };
            return str.replace(/&(lt|gt|nbsp|amp|quot);/ig, function (all, t) {
                return arrEntities[t];
            });
        },
        isSupportWebSocket: function () {
            if (!!window.WebSocket && window.WebSocket.prototype.send) {
                return true;
            }

            return false;
        }
    }

    return utils;
}));