/*
 * @Author: heng.xu
 * @Date:   2016/2/29 16:44
 * @Last Modified by:   wanghaowh.wang
 * @Last Modified time: 2017-05-09 20:09:13
 *@Last Modified content 修改获取用户信息接口 为了统一使用一个 
 * @Description   会话转移历史查看
 */

require("tmpl/sessionTransfer/msg.mustache");
require("lib/qevent/index.js");

var util = require("utils/utils_touch.js").utils;

var config = {
    historyUrl: '/qcadmin/msg/historyMsg.json',
    //vCard: '/api/get_user_vcard_info',
    vCard: '/newapi/domain/get_vcard_info.qunar',
    pageSize: 30,
    domain: window.nav_igator.baseaddess.domain
}

var History = {

    init: function() {

        this.$wrapper = $('#wrapper');
        this.$loading = $('#loading');
        this.$tip = $('#more_msg');
        this.from = this.getQueryString('from');
        this.to = this.getQueryString('to');
        this.u = this.getQueryString('u');
        this.k = this.getQueryString('k');
        this.show_time_old;
        this.show_time_new;
        this.show_msg_interval = 1000 * 60 * 2;
        this.DOWN_URL = window.nav_igator.baseaddess.fileurl;
        this.showImg_url = window.nav_igator.baseaddess.fileurl;
        this.msgIds = [];
        this.stridContainer = {};
        this.historying = false;

        this.initVCard([this.from, this.to]);
        this.fetchHistoryMsg(config.pageSize);
        this.initScroll();
        this.bindEvent();

    },

    fetchHistoryMsg: function(pageSize) {

        var self = this;
        if (this.historying) {
            return;
        }
        this.historying = true;
        if (!self.historyTime) {
            self.historyTime = Math.round(new Date().getTime() / 1000);
        }
        $.ajax({
            url: config.historyUrl,
            type: 'GET',
            dataType: 'jsonp',
            data: {
                from: self.from,
                to: self.to,
                timestamp: self.historyTime,
                limitNum: config.pageSize,
                direction: '0',
                u: self.u,
                k: self.k
            },
            success: function(res) {
                var response = res.data;
                var len = response.length;

                if (len > 0) {
                    for (var i = len - 1; i >= 0; i--) {
                        self.createHistoreyMessage(response[i], i == 0);
                    }
                    if (len == pageSize) {
                        setTimeout(function() {
                            self.historying = false;
                        }, 700);
                    } else {
                        self.$tip.find('.text').text('没有更多消息了').end().find('.yo-ico').hide();
                    }
                } else {
                    self.$tip.find('.text').text('没有更多消息了').end().find('.yo-ico').hide();
                }

            },
            error: function(error) {
                self.$tip.find('.text').text('您现在没有权限查看会话转移前的历史消息').end().find('.yo-ico').hide();
            },
            complete: function() {
                self.$loading.hide();
                self.$tip.show();
            }
        });

    },

    getQueryString: function(name) {
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
        var r = window.location.search.substr(1).match(reg);
        if (r != null) return decodeURIComponent(r[2]);
        return null;
    },

    createHistoreyMessage: function(msg, isSetTime) {
        var message = msg["b"],
            message = message.replace("</body>", "</msgbody>").replace("<body", "<msgbody"),
            $message = $(message),
            $body = $message.children('msgbody'),
            type = $message.attr('type'),
            body = $body.text(),
            msgType = $body.attr('msgType'),
            msgid = $body.attr('id'),
            stamp, sender, imageUrl, fullname;

        stamp = +$message.attr('msec_times');

        if (isSetTime) {
            this.historyTime = Math.floor(new Date(stamp).getTime() / 1000);
        }

        if (msgid) {
            if (this.msgIds.indexOf(msgid) > -1) {
                return true; // We already have this message stored.
            } else {
                this.msgIds.push(msgid);
            }
        }

        if (msg["f"] == this.to) {
            sender = 'them';
            imageUrl = this.stridContainer[this.to].imageurl;
            fullname = this.stridContainer[this.to].nickname || this.stridContainer[this.from].webname;
        } else if (msg["f"] == this.from) {
            sender = 'me';
            imageUrl = this.stridContainer[this.from].imageurl;
            fullname = this.stridContainer[this.from].nickname || this.stridContainer[this.from].webname;
        } else {
            return true;
        }

        var hm = {
            fullname: fullname,
            message: body || "",
            msgType: msgType,
            sender: sender,
            imageUrl: imageUrl,
            time: stamp,
            history: isSetTime ? 2 : 1,
            strid: msg["f"]
        }

        if (msgType == '1' || msgType == '5' || msgType == '10' || msgType == '11') {
            this.showMessage(hm);
        }

    },

    showMessage: function(msg_dict) {

        var $content = $('#msg_list'),
            msg_time = msg_dict.time || new Date().toString(),
            msg_type = msg_dict.msgType,
            text = msg_dict.message,
            fullname = msg_dict.fullname,
            imageUrl = msg_dict.imageUrl,
            extra_classes = msg_dict.delayed && 'delayed' || '',
            strid = msg_dict.strid,
            self = this;

        if (msg_type && msg_type == "10" && msg_dict.sender === 'me') {
            text = "您发送了一个窗口抖动";
        }

        if (msg_type && msg_type == "11" && text) {
            try {
                var obj = JSON.parse(text);
                if (obj && obj.url) {
                    text = '[obj type="url" value="' + obj.url + '"]';
                } else {
                    return;
                }
            } catch (e) {

            }
        }

        var msgHtml = QTMPL.msg.render({
            'sender': msg_dict.sender == 'me',
            'time': new Date(msg_time).format1('MM-dd hh:mm:ss'),
            'fullname': fullname,
            'imageUrl': imageUrl,
            'message': '',
            'extra_classes': extra_classes,
            'strid': strid
        });

        var msgContent = $(msgHtml).find('p').first().text(text);

        if (msg_type && msg_type == "5") {
            msgContent.addFileLinks(this.DOWN_URL);
        } else {
            this.handlerTypeSet(msgContent, msg_dict);
        }

        if (!msg_dict.history) {
            if (!this.show_time_new || (new Date(msg_time) - new Date(this.show_time_new)) > this.show_msg_interval) {
                var format = "yyyy/MM/dd hh:mm:ss";
                if (new Date(msg_time).format1("yyyyMMdd") == new Date(this.show_time_new).format1("yyyyMMdd")) {
                    format = "hh:mm:ss";
                }
                $content.append("<p class='date'><span>" + new Date(msg_time).format1(format) + "</span></p>");
                this.show_time_new = new Date(msg_time);
            }
            $content.append(msgContent.parent().parent());
        } else {
            $content.prepend(msgContent.parent().parent());
            if (this.show_time_old) {
                if ((new Date(this.show_time_old) - new Date(msg_time)) <= this.show_msg_interval) {
                    $(".date").first().remove();
                } else {
                    if (new Date(msg_time).format1("yyyyMMdd") == new Date(this.show_time_old).format1("yyyyMMdd")) {
                        $(".date").first().html('<span>' + new Date(this.show_time_old).format1("hh:mm:ss") + '</span>');
                    }
                }
            }
            $content.prepend("<p class='date'><span>" + new Date(msg_time).format1("yyyy/MM/dd hh:mm:ss") + "</span></p>");
            this.show_time_old = new Date(msg_time);
        }

        setTimeout(function() {
            self.pageScroll.refresh();
        }, 700);

    },

    handlerTypeSet: function(ele, msg_dict) {
        var re = /\[obj type=\"(.*?)\" value=\"(.*?)\"( width=(.*?) height=(.*?))?\]/g,
            self = this;
        if (ele.length > 0) {
            ele.each(function(i, obj) {
                var text = $(obj).html(),
                    imgDownUrl;
                text = text.replace(re, function() {
                    if (arguments && arguments.length > 2) {
                        if (arguments[1] === "image") {
                            imgDownUrl = self.showImg_url + arguments[2];
                            return;
                        } else if (arguments[1] === "emoticon") {
                            return '<img class="emotions" src="' + util.getEmoticonsUrl(arguments[2], self.DOWN_URL + "/file/v1/emo/d/e/") + '" alt="' + arguments[2] + '"/>';
                        } else if (arguments[1] === "url") {
                            if (msg_dict && msg_dict.sender && msg_dict.sender == 'me') {
                                return '<a href="' + arguments[2] + '" title="' + "打开网址" + '" style="text-decoration:underline;color: #fff;" target="_blank">' + arguments[2] + '</a>';
                            } else {
                                return '<a href="' + arguments[2] + '" title="' + "打开网址" + '" style="text-decoration:underline;color: #333333;" target="_blank">' + arguments[2] + '</a>';
                            }
                        } else {
                            return arguments[0];
                        }
                    }
                });
                if (imgDownUrl) {

                    QNR.qevent.fire('addImg', imgDownUrl, obj);

                } else {
                    $(obj).html(text);
                }

            });
        }
    },

    bindEvent: function() {

        QNR.qevent.on('addImg', function(imgUrl, obj) {
            obj.parentNode.className = 'txt-img';
            obj.innerHTML = '';
            $(obj).parent().css({
                'background': 'url("' + imgUrl + '") center center / .9rem .67rem no-repeat'
            });
        });

    },

    initScroll: function() {

        var self = this;

        this.$wrapper.find('.chat-list').css('min-height', (self.$wrapper.height() + 1) + 'px');

        this.pageScroll = new IScroll('#wrapper', {
            probeType: 2,
            mouseWheel: true,
            tap: true,
            click: true,
            momentum: true,
            bounce: true,
            bounceEasing: 'back'
        });

        this.pageScroll.on("scroll", function() {
            if (this.y > 30) {
                self.fetchHistoryMsg(config.pageSize);
            }
        });

    },

    getVCard: function(strid) {
        if (strid) {
            var self = this;
            //请求地址
            var requestURL = config.vCard + '?u=' + self.u + '&k=' + self.k;

            //统一使用一个接口
            var args = [{
                domain: config.domain,
                users: [{
                    user: strid,
                    version: '0'
                }]
            }];

            var param = {
                url: config.vCard,
                type: 'POST',
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify(args)
            };


            $.ajax($.extend(param, {
                success: function(resp) {

                    if (resp && resp.ret && resp.data.length > 0) {

                        var card = resp.data[0].users.length ? resp.data[0].users[0] : null;

                        if (!card) return;
      
                        var $userImg = $('[data-userImg="' + strid + '"]'),
                            $userName = $('[data-userName="' + strid + '"]'),
                            result = data.data[0];

                        if ($userImg.length > 0) {
                            $userImg.css({
                                'background-image': 'url(' + card.imageurl + ')'
                            });
                        }

                        if ($userName.length > 0) {
                            $userName.text((card.nickname || card.webname));
                        }

                        self.stridContainer[strid] = card;
                    }
                },
                error: function(error) {

                }
            }));
        }


        // if (strid) {
        //     var self = this,
        //         param = {
        //             url: config.vCard,
        //             type: 'POST',
        //             dataType: 'json',
        //             data: {u: self.u, k: self.k, strid: strid}
        //         };
        //     $.ajax($.extend(param, {
        //         success: function (data) {
        //             if (data.ret && data.data && data.data[0] && self.isNotEmpty(data.data[0])) {

        //                 var $userImg = $('[data-userImg="' + strid + '"]'),
        //                     $userName = $('[data-userName="' + strid + '"]'),
        //                     result = data.data[0];

        //                 if ($userImg.length > 0) {
        //                     $userImg.css({'background-image': 'url(' + result.imageurl + ')'});
        //                 }

        //                 if ($userName.length > 0) {
        //                     $userName.text((result.nickname || result.webname));
        //                 }

        //                 self.stridContainer[strid] = result;

        //             }
        //         },
        //         error: function (error) {

        //         }
        //     }));
        // }

    },

    initVCard: function(arr) {
        if (this.isNotEmpty(arr)) {
            var self = this;
            arr.forEach(function(v, i) {
                self.stridContainer[v] = {
                    nickname: v,
                    imageurl: ''
                }
                self.getVCard(v);
            });
        }
    },

    isNotEmpty: function(data) {
        if (Object.prototype.toString.call(data) == '[object Array]') {
            if (data.length > 0) {
                return true;
            } else {
                return false;
            }
        } else if (Object.prototype.toString.call(data) == '[object Object]') {
            for (var name in data) {
                return true;
            }
            return false;
        } else if (Object.prototype.toString.call(data) == '[object String]') {
            if (data.length > 0) {
                return true;
            }
            return false;
        } else {
            return false;
        }
    }

}

History.init();