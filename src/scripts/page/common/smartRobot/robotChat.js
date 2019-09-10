/**
 * @Author: wanghaowh.wang
 * @Date:   2017-11-02T12:23:40+08:00
 * @Filename: index.js
 * @Last modified by:   wanghaowh.wang
 * @Last modified time: 2017-11-02T12:24:04+08:00
 * @Description: 依赖jq, jq.cookie
 */


'use strict';

// 机器客服问题列表
require('./msg65536.mustache');
require('./msg65537.mustache');

var questionSuggest = require('./questionSuggest');
require('lib/alertify');

var FALSE = false,
    TRUE = true,
    text = '',
    empty = function() {};

function getQueryString(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    var r = window.location.search.substr(1).match(reg);
    if(r != null) return decodeURIComponent(r[2]);
    return null;
};

var robot = {
    sk: [], // 数据统计暂存
    onlyOnce: true, // 只产生一些FAQ
    onlyClick: true, // 只产生一次FAQ点击判断
    init: function(isRobotWorking, config) {
        var self = this;

        self.config = $.extend({
            chatObj: {},
            switchContact: empty,
            showMoreCallback: empty
        }, config);

        self.isRobotWorking = isRobotWorking;

        self._bindEvents(config.chatObj, config.switchContact);
    },
    handleRobotMessage: function(msgType, extendInfo, info) {
        var self = this;

        var message = JSON.parse(extendInfo || null);

        switch (msgType) {
            case '65536':
                var listArea = message.listArea,
                    listLen = listArea.items.length,
                    defSize = listArea.style.defSize;
                message.hasQuestionList = listLen > 0;
                message.hasMoreBtn = listLen > defSize;
                message.listMaxHeight = 29 * defSize + 'px';

                text = message.content;
                
                if(listArea && listArea.items && listArea.items.length) {
                    self.sk = listArea.items;
                }

                message.content = self.transferRichText(message.content);
                if(self.sk.length && self.onlyOnce) {
                    QNRSK.manual('qchat_faq_init', { // FAQ推送次数
                        edata: {
                            items: self.sk.length > 3 ? 3 : self.sk.length,
                            loadMore: self.sk.length > 3 ? true : false
                        }
                    });
                    self.onlyOnce = false;
                }
                return {
                    html: QTMPL.msg65536.render({
                            time: info.time,
                            username: info.username,
                            imageUrl: info.imageUrl,
                            message: message
                        }),
                    text: text
                };

            case '65537':
                return {
                    html: QTMPL.msg65537.render({
                            message: message
                        }),
                    text: text
                };

            default:
                return FALSE;
        }
    },
    transferRichText: function(text) {
        var self = this;

        return text.replace(
            /\[obj type=\"([^\"]+)\" value=\"([^\"]+)\"\]/ig,
            function(matchedAll, type, url) {
                switch (type) {
                    case 'url':
                        return self.transferAnchor(matchedAll, url);

                    case 'image':
                        return self.transferImage(matchedAll, url);

                    default:
                        return matchedAll;
                }
            }
        );

    },
    transferAnchor: function(text, url) {
        return '<a class="interface" href="' + url + '">' + url + '</a>';
    },
    transferImage: function(text, url) {
        return '<img src="' + url + '" />';
    },
    _bindEvents: function(chatObj, switchContact) {
        // 智能机器人问题列表的点击
        var self = this,
            bu = getQueryString('line'),
            pid = getQueryString('pid'),
            bsid = getQueryString('bsid'),
            backupInfo = [{
                type: 50010,
                data: {
                    bu: bu,
                    pid: pid,
                    bsid: bsid
                }
            }];

        $(document).on('click', '.js-sendRobotQuestion', function() {
            var api = this.getAttribute('data-url') || '',
                msg = this.getAttribute('data-msg'),
                type = this.getAttribute('data-type');
            if (type === 'interface') {
                api = api.replace('http:', location.protocol);

                if (chatObj.converse.sendMessage(msg, '', '', {
                    backupInfo: backupInfo
                })) {
                    chatObj.showMessage({
                        fullname: chatObj.converse.settings.get("myNickName"),
                        imageUrl: chatObj.converse.settings.get("myImage") || defaultHeadImage,
                        sender: 'me',
                        message: msg,
                        msgType: "1"
                    }, true, true);

                    // 由于发送消息走的是消息队列，因此chatObj.converse.sendMessage是异步执行的；FAQ回复由下面这个请求触发，为了保证时序，延时120ms调用接口
                    // 为什么是120ms? 看sendMessage的逻辑，最大可能延时100ms发送
                    setTimeout(function() {
                        api && $.ajax({
                            url: api,
                            type: 'GET',
                            dataType: 'jsonp'
                        });
                    }, 120);
                }
            }
            if(self.onlyClick) {
                QNRSK.manual('qchat_faq_one', { // FAQ点击次数
                    edata: {
                        items: self.sk.length
                    }
                });
                self.onlyClick = false;
            }
            QNRSK.manual('qchat_faq_item', { // 用户点击问题条数
                edata: {
                    items: self.sk.length > 3 ? 3 : self.sk.length,
                    content: msg
                }
            });
        }).on('click', '#js-moreRobotQuestion', function() {
            $(this).addClass('hide').siblings('.question-list').addClass('height-auto');
            self.config.showMoreCallback();
            QNRSK.manual('qchat_faq_loadmore', { // 查看更多点击次数
                edata: {
                    items: self.sk.length - 3
                }
            });
        }).on('click', '.js-needStaffService', function() {
            var api = this.getAttribute('data-url'),
                msg = this.getAttribute('data-msg'),
                type = this.getAttribute('data-type');

            if (type === 'interface') {
                api && $.get(api);
                    self.switchToStaff(chatObj, switchContact);
            }
        });
    },
    // 转到人工
    switchToStaff: function(chatObj, switchContact) {
        var setting = chatObj.setting,
            shopId = setting.virtualId,
            strid = getQueryString('strid'),
            bu = setting.bu_name,
            service_type = setting.service_type,
            service_url = setting.service_url,
            pid = getQueryString('pid'),
            _q = $.cookie('_q'),
            userQName = chatObj.userQName || _q && _q.slice(2) || '',
            self = this;

        $.ajax({
            url: '/api/seat/judgmentOrRedistributionEx.json',
            type: 'GET',
            dataType: 'jsonp',
            data: {
                shopId: shopId,
                seatQName: strid, // 当前座席的id
                userQName: userQName,   // “我” 当前登陆人的id
                pdtId: pid ,    // 产品id
                noteArgs: JSON.stringify({
                    seatQName: strid,
                    userQName: userQName,
                    bu: bu,
                    type: service_type,
                    virtualId: shopId || '',
                    url: service_url
                }),    // 与productDtl 接口的 noteArgs 相同
                line: bu,       // 业务线id
                sendNote: 1
            }
        }).done(function(res) {
            if (res.ret && res.data && res.data.switchOn) {
                var seat = res.data.seat,
                    strid = seat.qunarName,
                    webName = seat.webName,
                    supplier = res.data.supplier,
                    shopName = supplier.name,
                    seatId = seat.id;

                self.stopRobot();
                questionSuggest.closeSuggest();

                if (typeof switchContact === 'function') {
                    switchContact({
                        strid: strid,
                        shopId: shopId,
                        webName: webName,
                        shopName: shopName
                    });
                    // leftBar.switchContact({
                    //     strid: strid,
                    //     virtualId: shopId,
                    //     webName: webName,
                    //     shopName: shopName,
                    //     host: 'ejabhost2'
                    // });
                    //
                    // leftBar.setCache(shopId, strid, webName);
                }

                // sayHello({
                //     from: strid,
                //     to: userQName,
                //     line: chatObj.business_name,
                //     seatId: seatId,
                //     virtualId: shopId,
                //     seatHost: 'ejabhost2'
                // });
            } else {
                // QNR.alertify({
                //    cancel: true,
                //    cancel_text: '确定',
                //    data: {
                //        title: '消息',
                //        text: ''
                //    }
                // });
                alert('人工客服忙，请稍候尝试')
            }
        });
    },
    stopRobot: function() {
        this.isRobotWorking = false;
    }
};

module.exports = robot;