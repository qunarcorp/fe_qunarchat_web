(function(root, factory) {

    var emotions = require("emotions/emotions.js").emotions,
        utils = factory(jQuery, emotions);
    module.exports = {
        utils: utils
    }
}(this, function($, emotions) {
    "use strict";
    var _range;
    $.expr[':'].emptyVal = function(obj) {
        return obj.value === '';
    };

    $.fn.hasScrollBar = function() {
        if (!$.contains(document, this.get(0))) {
            return false;
        }
        if (this.parent().height() < this.get(0).scrollHeight) {
            return true;
        }
        return false;
    };

    Date.prototype.format1 = function(format) {
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
    $.fn.addFileLinks = function(down_url) {
        if (this.length > 0) {
            this.each(function(i, obj) {
                var text = $(obj).html();
                //var text=text.replace(/[\r\n]/g,"");
                var jsonVal = eval('(' + text + ')');
                var fileName = jsonVal.FileName;
                var httpUrl = jsonVal.HttpUrl;
                //兼容老接口的地址需要加上域名
                if (httpUrl.indexOf("cgi-bin") > -1 && httpUrl.indexOf("http") === -1) {
                    httpUrl = down_url + jsonVal.HttpUrl;
                }
                $(obj).html('文件：<a href="' + httpUrl + '" style="text-decoration:underline;" title="' + "下载文件" + '">' + fileName + '</a>');
            });
        }
        return this;
    };
    $.fn.typeSet = function(hostObj) {
        var re = /\[obj type=\"(.*?)\" value=\"(.*?)\"( width=(.*?) height=(.*?))?\]/g;
        if (this.length > 0) {
            this.each(function(i, obj) {
                var text = $(obj).html();
                text = text.replace(re, function() {
                    if (arguments && arguments.length > 2) {
                        if (arguments[1] === "image") {

                            var httpUrl = arguments[2];
                            var imgObj = '<img src="' + httpUrl + '"/>'
                                //兼容老接口的地址需要加上域名
                            if (httpUrl.indexOf("cgi-bin") > -1 && httpUrl.indexOf("http") === -1) {
                                imgObj = '<img src="' + hostObj.showImg_url + httpUrl + '"/>'
                            }
                            return imgObj;

                        } else if (arguments[1] === "emoticon") {
                            return '<img src="' + utils.getEmoticonsUrl(arguments[2], hostObj.down_url + "/file/v1/emo/d/e/") + '" alt="' + arguments[2] + '"/>';
                        } else if (arguments[1] === "url") {
                            return '<a href="' + arguments[2] + '" title="' + "打开网址" + '" style="text-decoration:underline;" target="_blank">' + arguments[2] + '</a>'
                        } else {
                            return arguments[0];
                        }
                    }
                });
                $(obj).html(text);
            });
        }
        return this;
    }
    var utils = {

        //字节变为兆
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
        getEmoticonsUrl: function(shortcut, serverUrl) {
            if (!shortcut || shortcut.length == 0) return "";
            shortcut = shortcut.substring(1, shortcut.length - 1);
            for (var i = 0; i < emotions.length; i++) {
                /*var obj=$.parseJSON(emotions[i]);*/
                var obj = emotions[i];
                var NS = obj.FACESETTING.DEFAULTFACE["-categery"];
                var Fixed = "/fixed";
                var faces = obj.FACESETTING.DEFAULTFACE.FACE;
                for (var j = 0; j < faces.length; j++) {
                    if (faces[j]["-shortcut"] === shortcut) {
                        return serverUrl + NS + faces[j]["-shortcut"]+ Fixed;
                    }
                }
            }
            return "";

        },
        showEmoticons: function(serverUrl) {
            //serverUrl += "webchat/emotions/";
            serverUrl += "/file/v1/emo/d/e/";
            var ulStr = '';
            for (var i = 0; i < emotions.length; i++) {
                //var obj=$.parseJSON(emotions[i]);
                var obj = emotions[i];
                var NS = obj.FACESETTING.DEFAULTFACE["-categery"];
                var Fixed = "/fixed";
                var width = obj.FACESETTING.DEFAULTFACE["-width"];
                var height = obj.FACESETTING.DEFAULTFACE["-height"];
                var faces = obj.FACESETTING.DEFAULTFACE.FACE;
                var len = faces.length;
                ulStr += '<ul>';
                for (var j = 0; j < len; j++) { //title="'+faces[j]["-tip"]+'"
                ulStr += '<li><img src=\'' + serverUrl + NS + faces[j]["-shortcut"] + Fixed +
                '\' data-emoticon=\'' + faces[j]["-shortcut"] + '\'/></li>';
                }
                ulStr += '</ul>';
            }
            return ulStr;
        },
        replaceUrl: function(content) {
            var re = /<(img|IMG) src=\"(.*?)\" data-emoticon=\"(.*?)\">/g;
            var emoticons = content.match(re);
            if (emoticons) {
                for (var i = 0; i < emoticons.length; i++) {
                    var str = emoticons[i].replace(re, function() {
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
            /*content = content.replace(/(<[^>]*>)/g,function($0,$1){
                if(/<img[^>]*>/gi.test($1)){
                    return $1;
                }
            });*/
            content = content.replace(/</g, '&lt;');
            content = content.replace(/>/g, '&gt;');
            return content;
        },

        saveRange: function(el) {
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
        insertimg: function(str, el) {
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

        pasteHandler: function(el, event) {
            var self = this;
            setTimeout(function() {
                var content = el.innerHTML;
                content = content.replace(/(<[^>]*>)/g, function($0, $1) {
                    if (/<img[^>]*>/gi.test($1)) {
                        return $1;
                    } else {
                        return "";
                    }
                });
                el.innerHTML = content;
                self.saveRange();
            }, 1);
        },

        getUA: function() {
            var ua = window.navigator.userAgent;
            ua = ua.toLowerCase();
            // 微信内置浏览器
            if (/micromessenger/i.test(ua)) {
                return {
                    wechat: true,
                    version: ''
                };
            } else {
                return {
                    h5: true,
                    version: ''
                };
            }
        },

        createRandomNumber: function(start, end) {
            var start = parseInt(start),
                end = parseInt(end),
                middle = end - start;
            return Math.random() * middle + start;
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

        /*
         * 特殊字符转换为Html标签
         */
        escape2Html: function(str) {
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
            return str.replace(/&(lt|gt|nbsp|amp|quot);/ig, function(all, t) {
                return arrEntities[t];
            });
        }

    }

    return utils;
}));