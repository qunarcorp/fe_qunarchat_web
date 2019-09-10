(function (root, factory) {
    require("../../navigation.js");
    var _ = require('underscore');
    require('moment');
    require("./lib/strophejs/strophe.js");
    require("./lib/strophejs-plugins/strophe.vcard.js");
    require("./lib/strophejs-plugins/strophe.disco.js");
    require("./lib/strophejs-plugins/strophe.ping.js");

    module.exports = {
        converse: factory(jQuery, $iq, $msg, $pres, $build, Strophe, _, b64_sha1),
        ConnectionStatus: window.Strophe.Status
    }

}(this, function ($, $iq, $msg, $pres, $build, Strophe, _, b64_sha1) {
    // "use strict";
    // Cannot use this due to Safari bug.
    // See https://github.com/jcbrand/converse.js/issues/196
    if (typeof console === "undefined" || typeof console.log === "undefined") {
        console = {
            log: function () { },
            error: function () { }
        };
    }

    // 是否低版本浏览器 IE8及以下
    var isLowBrowser = (navigator.appName == 'Microsoft Internet Explorer' && parseInt(navigator.appVersion, 10) <= 4);

    // 用于是否锁定发送消息
    var sendMsgLock = {
        status: false,
        redirectToken: ''
    }

    var contains = function (attr, query) {
        return function (item) {
            if (typeof attr === 'object') {
                var value = false;
                _.each(attr, function (a) {
                    value = value || item.get(a).toLowerCase().indexOf(query.toLowerCase()) !== -1;
                });
                return value;
            } else if (typeof attr === 'string') {
                return item.get(attr).toLowerCase().indexOf(query.toLowerCase()) !== -1;
            } else {
                throw new TypeError('contains: wrong attribute type. Must be string or array.');
            }
        };
    };
    contains.not = function (attr, query) {
        return function (item) {
            return !(contains(attr, query)(item));
        };
    };

    var converse = {};
    converse.initialize = function (settings, operations) {
        var converse = this;
        var unloadevent;
        if ('onbeforeunload' in window) {
            unloadevent = 'beforeunload';
        } else if ('onunload' in window) {
            unloadevent = 'unload';
        } else if ('onpagehide' in window) {
            // Mobile Safari (at least older versions) doesn't support unload or beforeunload.
            // Apple recommends "pagehide" instead.
            unloadevent = 'pagehide';
        }

        // Logging
        Strophe.log = function (level, msg) {
            converse.log(level + ' ' + msg, level);
        };
        Strophe.error = function (msg) {
            converse.log(msg, 'error');
        };

        // Add Strophe Namespaces
        Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
        Strophe.addNamespace('REGISTER', 'jabber:iq:register');
        Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
        Strophe.addNamespace('XFORM', 'jabber:x:data');
        Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');

        // Add Strophe Statuses

        if (Object.keys) {
            var i = 0;
            Object.keys(Strophe.Status).forEach(function (key) {
                i = Math.max(i, Strophe.Status[key]);
            });
        } else {
            var i = 0;
            var keysCon = [],
                kval;
            for (var s in Strophe.Status) {
                keysCon.push(s);
            }
            for (var k = 0; k < keysCon.length; k++) {
                kval = keysCon[k];
                i = Math.max(i, Strophe.Status[kval]);
            }
        }
        // 这里的i取到使用中的最大值
        Strophe.Status.REGIFAIL = i + 1;
        Strophe.Status.REGISTERED = i + 2;
        Strophe.Status.CONFLICT = i + 3;
        Strophe.Status.NOTACCEPTABLE = i + 5;

        // Constants
        // ---------
        var LOGIN = "login";
        var ANONYMOUS = "anonymous";

        var ConnectionStatus = Strophe.Status;
        // 反enum，取值对应的文案
        var PRETTY_CONNECTION_STATUS = {
            0: 'ERROR',
            1: 'CONNECTING',
            2: 'CONNFAIL',
            3: 'AUTHENTICATING',
            4: 'AUTHFAIL',
            5: 'CONNECTED',
            6: 'DISCONNECTED',
            7: 'DISCONNECTING',
            8: 'ATTACHED',
            9: 'REDIRECT'
        };

        // XEP-0085 Chat states
        // http://xmpp.org/extensions/xep-0085.html
        // 不在线
        var INACTIVE = 'inactive';
        // 在线
        var ACTIVE = 'active';
        // 正在输入
        var COMPOSING = 'composing';
        // 暂时离开
        var PAUSED = 'paused';
        // 离开
        var GONE = 'gone';

        this.chatJid = null; //聊天对象
        this.chatName = null;
        this.chatImage = null;
        this.clientuin = null;
        this.myId = null;
        this.historyTime = undefined;

        // Default configuration values
        // ----------------------------
        this.default_settings = {
            allow_logout: true,
            auto_login: false, // Currently only used in connection with anonymous login
            auto_reconnect: true,
            auto_subscribe: false,
            bosh_service_url: undefined, // The BOSH connection manager URL.
            debug: false,
            expose_rid_and_sid: false,
            forward_messages: false,
            jid: undefined,
            message_carbons: false,
            no_trimming: false, // Set to true for phantomjs tests (where browser apparently has no width)
            ping_interval: 20, //in seconds
            password: undefined,
            use_vcards: true,
            domain: '', // 自己所在域名
            toDomain: '', // 聊天对象所在域
            http_api_server: undefined,
            uin: undefined, //坐席uin
            strid: undefined,
            cctext: undefined,
            virtualId: undefined,
            seatId: '',
            pid: '',
            bu_name: undefined, //业务类型
            service_type: undefined, //售前售后
            service_url: undefined, //产品或者订单url
            key: undefined,
            myName: undefined,
            myNickName: undefined,
            myImage: undefined,
            chatType: '',
            ipAddress: '',
            notGetHistory: false,
            groupName: '',
            gid: undefined,
            ornamental: '',
            groupnotice: '',
            maType: '', //平台类型 web:6,touch:7(touch区分设备类型: iphone:7,ipod:8,ipad:9, android:10)
            virtualAcc: '', //第三方虚拟账户对像object={}
            virtualId: '', // 初始化的时候对方的虚拟账号
            // 是否是用户中心账号系统登陆
            isUCenter: false,
            // 业务方登陆id
            busiLoginId: '',
            // 业务方登陆类型
            busiLoginType: '',
            isAnonymous: false,
            useWebSocket: false,
            backupinfo: '',
            newDomain: window.nav_igator.baseaddess.domain
        };
        
        _.extend(this, this.default_settings);

        // Allow only whitelisted configuration attributes to be overwritten
        this.paramx = [];
        if (Object.keys) {
            this.paramx = Object.keys(this.default_settings);
        } else {
            for (var s in this.default_settings) {
                this.paramx.push(s);
            }
        }

        _.extend(this, _.pick(settings, this.paramx));      

        converse.domain = converse.newDomain;
        converse.toDomain = converse.newDomain;

        // 匿名登陆只尝试一次，如果接口返回false，弹层普通登陆框
        this.loginMaxTryCount = this.isAnonymous ? 1 : 3;

        if (this.domain === undefined) {
            throw ("Config Error:need to provide the server's domain");
        }
        if (!operations.onMsgCallback) {
            throw ("onMsgCallback can't be empty");
        }

        // 如果配置了自己的虚拟账号，则标识开启了consult消息模式
        this.isConsult = !!this.virtualId;
        // Module-level variables
        // ----------------------
        this.onMsgCallback = operations.onMsgCallback;
        this.onHistory = operations.onHistory || function () { };
        this.onHistoryPatch = operations.onHistoryPatch;
        this.onStatusChangeCallback = operations.onStatusChangeCallback;
        this.onConnectedCallback = operations.onConnectedCallback;
        this.onCard = operations.onCard;

        this.initGroupCard = operations.initGroupCard;
        this.sendWapInfo = operations.sendWapInfo || false;
        this.runContext = operations.runContext || false;
        this.notGetHistory = operations.notGetHistory || false;
        this.onChatReady = operations.onChatReady || false;
        this.onMemberChange = operations.onMemberChange || false;
        this.onReconnecting = operations.onReconnecting || function () { };
        this.sendEmotions = operations.sendEmotions || false;
        this.replyMessage = operations.replyMessage || false;
        this.isPreference = operations.isPreference || false; //是否是特价，特价如果会话转移不清stridContainer
        this.updateGroupInfo = operations.updateGroupInfo;
        this.updateNotice = operations.updateNotice;
        this.onPlayNotificationCallback = operations.onPlayNotificationCallback; //播放声音callback
        this.onGetC2bOrderCallback = operations.onGetC2bOrderCallback; //获取C2B订单信息
        this.onGetProductDetailCallback = operations.onGetProductDetailCallback; //获取产品详情信息
        this.onAuthDone = operations.onAuthDone;
        this.onAuthFail = operations.onAuthFail;
        this.onSendMsgLock = operations.onSendMsgLock || null;
        this.onMsgLockCheck = operations.onMsgLockCheck || null;
        this.onReadmarkCallback = operations.onReadmarkCallback || null;
        this.checkCCText = operations.checkCCText || null;
        // this.onLeftBarReLoadContact = operations.onLeftBarReLoadContact;//重新加载左边用户列表
        this.msg_counter = 0;
        this.msgIds = [];
        this.stridContainer = {};

        // 标记当前联系人
        this.contactsCache = {};
        this.reconnectCount = 0;

        // 标记是否取到了chat key
        this.chatDeffered = new $.Deferred();
        this.defaultChatImage = '../../assets/png/defaultAvatar.png';

        //consult类型约定固定参数
        this.chatInfoChannelid = '{"cn":"consult","d":"send","usrType":"usr"}';
        this.chatInfoChatid = "4"; //客人向客服发消息增加这个属性

        // Module-level functions
        // ----------------------

        this.giveFeedback = function (status, reconnect) {
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback(status, reconnect);
            }
        };

        this.log = function (txt, level) {
            if (this.debug) {
                if (level == 'error') {
                    console.error('ERROR: ' + txt);
                } else {
                    console.log(txt);
                }
            }
        };
        this.getNameFormStrid = function (strid) {
            if (strid) {
                var index = strid.lastIndexOf('@');
                if (index > 0) {
                    strid = strid.slice(0, index);
                }
                return strid;
            }
        };

        this.getVCard = function (jid, callback, errback) {
            /* Request the VCard of another user.
             *  Parameters:
             *    (String) jid - The Jabber ID of the user whose VCard is being requested.
             *    (Function) callback - A function to call once the VCard is returned
             *    (Function) errback - A function to call if an error occured
             *      while trying to fetch the VCard.
             */
            if (!this.use_vcards) {
                if (callback) {
                    callback(jid, jid);
                }
                return;
            }
            converse.connection.vcard.get(
                $.proxy(function (iq) { // Successful callback
                    var $vcard = $(iq).find('vCard');
                    var fullname = $vcard.find('FN').text(),
                        img = $vcard.find('BINVAL').text(),
                        img_type = $vcard.find('TYPE').text(),
                        url = $vcard.find('URL').text();
                    if (callback) {
                        callback(iq, jid, fullname, img, img_type, url);
                    }
                }, this),
                jid,
                function (iq) { // Error callback
                    if (errback) {
                        errback(iq, jid);
                    }
                }
            );
        };

        this.reconnect = function (condition) {
            converse.log('Attempting to reconnect in 5 seconds');
            // 最多允许重连10次，间隔5秒
            if (this.reconnectCount === 10) {
                this.onReconnecting(-1);
                return
            }

            setTimeout(function () {
                this.reconnectCount++;
                this.onReconnecting(this.reconnectCount);

                this.connection.connect(
                    this.connection.jid,
                    this.connection.pass,
                    function (status, condition) {
                        this.onConnectStatusChanged(status, condition, true);
                    }.bind(this),
                    this.connection.wait,
                    this.connection.hold,
                    this.connection.route
                );
            }.bind(this), 5000);
        };

        this.renderLoginPanel = function (msg) {
            this.connection.reset();
            this.onAuthFail(msg);
        };

        this.onConnectStatusChanged = function (status, condition, reconnect) {
            converse.log("Status changed to: " + PRETTY_CONNECTION_STATUS[status]);
            var statusMsg,
                statusArgs = status;

            if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.ATTACHED) {
                delete converse.disconnection_cause;
                if ((typeof reconnect !== 'undefined') && (reconnect)) {
                    converse.log(status === ConnectionStatus.CONNECTED ? 'Reconnected' : 'Reattached');
                    converse.onReconnected();
                } else {
                    converse.log(status === ConnectionStatus.CONNECTED ? 'Connected' : 'Attached');
                    converse.onConnected();
                }
            } else if (status === ConnectionStatus.DISCONNECTED) {
                converse.giveFeedback(statusArgs);

                if (converse.disconnection_cause == ConnectionStatus.CONNFAIL && converse.auto_reconnect) {
                    converse.reconnect(condition);
                    converse.giveFeedback(ConnectionStatus.CONNECTING);
                } else {
                    converse.renderLoginPanel('disconnected');
                }
                statusArgs = null;
            } else if (status === ConnectionStatus.AUTHFAIL) {
                //converse.connection.disconnect('Authentication Failed');
                converse.disconnection_cause = ConnectionStatus.AUTHFAIL;
                converse.renderLoginPanel('auth fail');
            } else if (status === ConnectionStatus.CONNFAIL) {
                converse.disconnection_cause = ConnectionStatus.CONNFAIL;
            } else if (status === ConnectionStatus.DISCONNECTING) {
                statusArgs = condition ? condition : 'connec fail';
                statusMsg = 'error';
            }

            statusArgs && converse.giveFeedback(statusArgs, reconnect);
        };


        this.updateMsgCounter = function () {
            if (this.msg_counter > 0) {
                if (document.title.search(/^您有新的未读消息 \(\d+\) /) == -1) {
                    document.title = "您有新的未读消息 (" + this.msg_counter + ") " + document.title;
                } else {
                    document.title = document.title.replace(/^您有新的未读消息 \(\d+\) /, "您有新的未读消息 (" + this.msg_counter + ") ");
                }
                window.blur();
                window.focus();
            } else if (document.title.search(/^您有新的未读消息 \(\d+\) /) != -1) {
                document.title = document.title.replace(/^您有新的未读消息 \(\d+\) /, "");
            }
        };

        this.incrementMsgCounter = function () {
            this.msg_counter += 1;
            this.updateMsgCounter();
        };

        this.clearMsgCounter = function () {
            this.msg_counter = 0;
            this.updateMsgCounter();
        };

        this.logOut = function () {
            if (converse.connection.connected) {
                converse.connection.disconnect();
            }
        };
        this.registerGlobalEventHandlers = function () {
            $(window).on("blur focus", $.proxy(function (ev) {
                if ((this.windowState != ev.type) && (ev.type == 'focus')) {
                    converse.clearMsgCounter();
                }
                this.windowState = ev.type;
            }, this));
        };

        this.ping = function (jid, success, error, timeout) {
            // XXX: We could first check here if the server advertised that it supports PING.
            // However, some servers don't advertise while still keeping the
            // connection option due to pings.
            //
            // var feature = converse.features.findWhere({'var': Strophe.NS.PING});
            converse.lastStanzaDate = new Date();
            if (typeof jid === 'undefined' || jid === null) {
                jid = Strophe.getDomainFromJid(converse.bare_jid);
            }
            if (typeof timeout === 'undefined') {
                timeout = null;
            }
            if (typeof success === 'undefined') {
                success = null;
            }
            if (typeof error === 'undefined') {
                error = null;
            }
            if (converse.connection) {
                converse.connection.ping.ping(jid, success, error, timeout);
                return true;
            }
            return false;
        };

        this.pong = function (ping) {
            converse.lastStanzaDate = new Date();
            converse.connection.ping.pong(ping);
            return true;
        };

        this.registerPongHandler = function () {
            converse.connection.disco.addFeature(Strophe.NS.PING);
            converse.connection.ping.addPingHandler(this.pong);
        };

        this.registerPingHandler = function () {
            this.registerPongHandler();
            if (converse.ping_interval > 0) {
                converse.connection.addHandler(function () {
                    /* Handler on each stanza, saves the received date
                     * in order to ping only when needed.
                     */
                    converse.lastStanzaDate = new Date();
                    return true;
                }.bind(converse));
                this.connection.addTimedHandler(1000, function () {
                    now = new Date();
                    if (!converse.lastStanzaDate) {
                        converse.lastStanzaDate = now;
                    }
                    var interval = (now - converse.lastStanzaDate) / 1000;
                    if (interval > converse.ping_interval) {
                        return converse.ping();
                    }
                    return true;
                });
            }
        };

        this.onReconnected = function () {
            this.chatBox.registerMessageHandler();
            if (this.chatType !== 'groupTouch' && this.strid) {
                this.chatBox.stridSpecified(this.strid, this.pid);
            }

            this.registerPingHandler();
            this.setPriority();
        };

        this.enableCarbons = function () {
            /* Ask the XMPP server to enable Message Carbons
             * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
             */
            if (!this.message_carbons) { //|| this.session.get('carbons_enabled')) {
                return;
            }

            var carbons_iq = new Strophe.Builder('iq', {
                from: this.connection.jid,
                id: 'enablecarbons',
                type: 'set'
            }).c('enable', {
                xmlns: 'urn:xmpp:carbons:2'
            });

            this.connection.addHandler($.proxy(function (iq) {
                if ($(iq).find('error').length > 0) {
                    converse.log('ERROR: An error occured while trying to enable message carbons.');
                } else {
                    converse.log('Message carbons have been enabled.');
                }
            }, this), null, "iq", null, "enablecarbons");

            this.connection.send(carbons_iq);
        };

        this.setPriority = function () {
            var per = $pres().c('priority').t(5).up().c("c", {
                xmlns: "http://jabber.org/protocol/caps",
                node: "http://psi-im.org/caps",
                ver: "caps-b75d8d2b25",
                ext: "ca cs ep-notify-2 html"
            });

            converse.connection.send(per);
        };

        this.joinGroupChat = function () {
            var groupAdress = this.gid + '@' + this.ornamental + '/' + this.myId,
                per = $pres({
                    to: groupAdress
                }).c('priority').t(5).up().c("x", {
                    xmlns: "http://jabber.org/protocol/muc"
                });

            converse.connection.send(per);
        };

        this.onConnected = function () {
            // When reconnecting, there might be some open chat boxes. We don't
            // know whether these boxes are of the same account or not, so we
            // close them now.
            this.jid = this.connection.jid;
            this.domain = Strophe.getDomainFromJid(this.jid);
            this.bare_jid = Strophe.getBareJidFromJid(this.jid);
            this.myName = Strophe.getNodeFromJid(this.jid);
            this.myId = Strophe.getNodeFromJid(this.jid);

            this.enableCarbons();
            this.registerPingHandler();
            this.setPriority();

            // group talk -- 群消息暂时忽略,暂不支持
            if (typeof this.onConnectedCallback === 'function') {
                this.onConnectedCallback.call(converse.runContext, converse.myId, converse.key);
            }

            // this.chatType === 'groupTouch'
            if (false) {
                this.stridContainer = [];
                this.joinGroupChat();
                this.chatBox.addFromUINForGroup(this.pid);
            } else if (this.strid) {
                // 只有指定了对方账号的时候才去添加联系人
                this.chatBox.stridSpecified(this.strid, this.virtualId);

                // 设置默认的cctext
                if (this.cctext) {
                    var contact = converse.contactsCache[this.strid];
                    // 如果没配置过cctext，那么第一次的时候配置
                    // 如果消息发送过程中对方的cctext有更新和本地不一样，以谁为准？
                    contact.cctext = this.cctext;
                }
            }

            this.chatDeffered.done($.proxy(function () {
                this.chatBox.getCard(this.myId);
            }, this));
        };

        this.isNotEmpty = function (data) {
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
        };

        this.setStridContainer = function (strids) {
            if (!strids || $.isArray(strids) === false || strids.length === 0) {
                return
            }
            for (var i = 0; i < strids.length; i++) {
                this.stridContainer[strids[i]] = {
                    msgIds: [],
                    msgCount: 0,
                    isNewConnect: true
                }
            }
        }

        this.cleanOnChatEnd = function (strid) {
            if (!strid) {
                return
            }

            if (converse.stridContainer[strid]) {
                delete converse.stridContainer[strid];
            }

            if (converse.contactsCache[strid]) {
                delete converse.contactsCache[strid];
            }
        }

        this.chatBox = {
            registerMessageHandler: function () {
                var self = this;
                // addHandler (handler, ns, name, type, id, from, options)
                // the handler should return true if wish to invoke it again
                // if false, then the handle will be removed after the first invoked

                // 接收对方已读消息
                converse.connection.addHandler($.proxy(function (message) {
                    this.onNormalMessage(message, 'readmark');
                    return true;
                }, this), null, 'message', 'readmark');

                converse.connection.addHandler($.proxy(function (message) {
                    this.onNormalMessage(message, 'chat');
                    return true;
                }, this), null, 'message', 'chat');

                converse.connection.addHandler($.proxy(function (message) {
                    this.onNormalMessage(message, 'chat', 'Transfer');
                    return true;
                }, this), null, 'message', 'Transfer');

                converse.connection.addHandler($.proxy(function (message) {
                    this.onGroupMessage(message);
                    return true;
                }, this), null, 'message', 'groupchat');

                converse.connection.addHandler(function (message) {
                    setTimeout(function () {
                        self.onConsultMessage(message);
                    }, 100);

                    return true;
                }, null, 'message', 'consult');

                converse.connection.addHandler($.proxy(function (message) {
                    this.onPresence(message);
                    return true;
                }, this), null, 'presence');

                converse.connection.addHandler($.proxy(function (message) {
                    this.onOverBalance(message);
                    return true;
                }, this), null, 'message', 'web-overbalance');
            },

            // 指定了strid - 第一次建立连接时执行的逻辑
            stridSpecified: function (strid, virtualId, domain) {
                //debugger
                // 未指定聊天对象的情况下，不建立连接
                if (!strid) {
                    return
                }

                if (typeof strid === 'object') {
                    var originStrid = strid;
                    domain = strid.host || strid.domain;
                    virtualId = strid.virtualId || "";
                    strid = strid.strid;
                }

                // 设置当前active的strid
                converse.strid = converse.chatName = strid;
                converse.virutalId = virtualId || '';
                converse.chatJid = strid + "@" + (domain || converse.toDomain);

                this.setChatInfo(strid, virtualId, domain);

                var stridInfo = converse.stridContainer[strid];

                if (stridInfo) {
                    // 一旦指定了新连接，就不认为是new connect
                    stridInfo.isNewConnect = false;

                    this.allMessageRead(strid);

                    if (originStrid && originStrid.chatImage) {
                        stridInfo.chatImage = originStrid.chatImage;
                    } else {
                        stridInfo.chatImage = '../../assets/png/defaultAvatar.png';
                    }

                    return;
                }

                var isExist = this.checkCard(strid, false);

                if (originStrid && originStrid.chatImage) {
                    converse.stridContainer[strid].chatImage = originStrid.chatImage;
                }

                //等于c2b时不发送给后端
                if (converse.bu_name == '103') {
                    //获取订单信息(放到这里是因为获取用户信息后才用to值)
                    if (converse.onGetC2bOrderCallback) {
                        converse.onGetC2bOrderCallback.call(converse.runContext);
                    }
                } else {
                    converse.chatBox.sendServiceMsg();
                }

                converse.sendWapInfo && converse.sendWapInfo();
            },

            /**
             * 添加群聊会话
             * @param
             * @param
             */
            addFromUINForGroup: function (pid, callBack) {
                converse.chatBegin('', pid, function (iq) {
                    var $chatinfo = $(iq).find("chatinfo");
                    // converse.chatid = $chatinfo.attr("chatid");
                    //converse.chatJid = strid+"@"+converse.toDomain;
                    //converse.chatName = converse.strid;
                    //converse.clientuin=$chatinfo.attr("clientuin");
                    // converse.key = $chatinfo.attr("key");
                    // converse.token = $chatinfo.attr("token");
                    //converse.chatBox.sendServiceMsg();
                    //converse.log("key:"+converse.key);
                    //converse.chatBox.getVcard(strid);
                    converse.chatBox.getGroupMembers();
                    converse.chatBox.fetchGroupInfo();
                    // converse.chatBox.fetchGroupHistoryMsg(10, true); 暂不支持
                    if (converse.sendWapInfo) {
                        converse.sendWapInfo();
                    }
                }.bind(this));
            },

            getGroupMembers: function () {
                converse.connection.sendIQ(
                    $iq({
                        id: converse.gid,
                        type: "get",
                        to: converse.gid + '@' + converse.ornamental
                    }).c("query", {
                        xmlns: 'http://jabber.org/protocol/muc#register'
                    }),
                    function (iq) {
                        if ($(iq).find('error').length > 0) {

                        } else {
                            var query = $(iq).find('query');
                            if (query.length > 0) {
                                var userList = query.find('m_user'),
                                    container = {},
                                    vessel = [];
                                userList.each(function (i, v) {
                                    var user = $(v),
                                        jid = user.attr('jid'),
                                        arr = jid.split('@'),
                                        name = arr[0],
                                        domain = arr[1];
                                    if (container[domain]) {
                                        container[domain].users.push({
                                            user: name,
                                            version: 0
                                        });
                                    } else {
                                        container[domain] = {
                                            users: [{
                                                user: name,
                                                version: 0
                                            }]
                                        }
                                    }
                                });
                                for (var item in container) {
                                    if (container.hasOwnProperty(item)) {
                                        var obj = {
                                            domain: item,
                                            users: container[item].users
                                        }
                                        vessel.push(obj);
                                    }
                                }
                                converse.chatBox.getVcardForGroup(vessel);
                            }
                        }
                    }
                );
            },

            fetchGroupInfo: function () {
                $.ajax({
                    url: '/newapi/muc/get_muc_vcard.qunar?u=' + converse.myId + '&k=' + converse.key,
                    type: 'POST',
                    dataType: "json",
                    data: JSON.stringify([{
                        "domain": converse.domain,
                        "mucs": [{
                            "muc_name": converse.gid + '@' + converse.ornamental,
                            "version": "0"
                        }]
                    }]),
                    success: function (data) {
                        if (data.ret && data.data && converse.isNotEmpty(data.data)) {
                            converse.updateGroupInfo.call(converse.runContext, data.data[0]);
                            if (data.data[0] && data.data[0].mucs && data.data[0].mucs[0] && data.data[0].mucs[0].MT) {
                                converse.groupnotice = data.data[0].mucs[0].MT;
                            }
                        }
                    }.bind(this),
                    error: function (response) {

                    }.bind(this)
                });

            },

            getVcardForGroup: function (arr) {
                if (arr.length > 0) {
                    var config = {
                        url: '/newapi/domain/get_vcard_info.qunar?u=' + converse.myId + '&k=' + converse.key,
                        type: 'post',
                        dataType: 'json',
                        contentType: 'application/json',
                        data: JSON.stringify(arr)
                    };
                    $.ajax($.extend(config, {
                        success: function (data) {
                            if (data.ret && data.data && data.data.length > 0) {
                                data.data.forEach(function (v, i) {
                                    if (converse.isNotEmpty(v) && converse.isNotEmpty(v.users)) {
                                        v.users.forEach(function (vv, ii) {
                                            converse.stridContainer.push(vv);
                                            if (vv.username == converse.myId) {
                                                converse.myNickName = vv.nickname || vv.webname;
                                                converse.myImage = vv.imageurl;
                                            }
                                        });
                                    }
                                });
                                converse.onCard(converse.stridContainer);
                                converse.initGroupCard.call(converse.runContext, converse.stridContainer);
                            }
                        },
                        error: function (error) {

                        }
                    }));
                }
            },

            getVcardForNewJoin: function (arr) {
                if (arr.length > 0) {
                    var config = {
                        url: '/newapi/domain/get_vcard_info.qunar?u=' + converse.myId + '&k=' + converse.key,
                        type: 'post',
                        dataType: 'json',
                        contentType: 'application/json',
                        data: JSON.stringify(arr)
                    };
                    $.ajax($.extend(config, {
                        success: function (data) {
                            if (data.ret && data.data && data.data.length > 0) {
                                data.data.forEach(function (v, i) {
                                    if (converse.isNotEmpty(v) && converse.isNotEmpty(v.users)) {
                                        v.users.forEach(function (vv, ii) {
                                            converse.stridContainer.push(vv);
                                            converse.onCard([vv]);
                                            converse.onMemberChange.call(converse.runContext, vv, converse.stridContainer, '1');
                                        });
                                    }
                                });
                            }
                        },
                        error: function (error) {

                        }
                    }));
                }
            },

            isOnlyChatStateNotification: function ($msg) {
                // See XEP-0085 Chat State Notification
                return (
                    $msg.find('body').length === 0 && (
                        $msg.find(ACTIVE).length !== 0 ||
                        $msg.find(COMPOSING).length !== 0 ||
                        $msg.find(INACTIVE).length !== 0 ||
                        $msg.find(PAUSED).length !== 0 ||
                        $msg.find(GONE).length !== 0
                    )
                );
            },

            stridSpecifiedWrapper: function (strid, virtualId, cctext) {
                this.stridSpecified(strid, virtualId);

                var contact = converse.contactsCache[strid];
                // 如果没配置过cctext，那么第一次的时候配置
                // 如果消息发送过程中对方的cctext有更新和本地不一样，以谁为准？
                if (cctext) {
                    contact.cctext = cctext;
                }
            },
            /*
             * 设置聊天信息
             * strid:客服id
             * virtualId:虚拟ID(如:店铺ID)
             * domain 域名
             */
            setChatInfo: function (strid, virtualId, domain) {
                if (!strid) {
                    return
                }

                var info = converse.contactsCache[strid] || {};

                info.type = 'chat';
                info.domain = domain || converse.toDomain;
                info.resource = '';
                info.opposite = strid + '@' + info.domain;
                info.myId = Strophe.getBareJidFromJid(converse.connection.jid);

                if (virtualId) {
                    info.type = 'consult';
                    info.virtualId = virtualId + '@' + info.domain;
                }

                converse.contactsCache[strid] = info;

                return info;
            },

            // 设置转移后的客服
            setTransferedChatInfo: function (strid, virtualId) {
                if (!strid) {
                    throw Error('no strid');
                }

                var info = this.setChatInfo(strid, virtualId);

                converse.strid = strid;

                converse.contactsCache[virtualId] = info;
            },

            // 获取联系人的from，to
            // 增加了consult消息之后会出现from, realfrom, to, realto
            // 这里传入的strid都是real部分
            getChatInfo: function (strid) {
                //debugger
                var info = converse.contactsCache[strid];

                if (!info) {
                    return {
                        from: converse.connection.jid,
                        to: converse.chatJid
                    }
                }

                var ret = {
                    type: 'chat',
                    from: converse.connection.jid,
                    to: info.opposite
                }

                // 有才去加这个字段 - 抄送字段，运行接入方添加额外消息、标记 - 类似是字符串
                if (info.cctext) {
                    ret.cctext = info.cctext;
                }

                if (info.type === 'consult') {
                    ret.type = 'consult';
                    ret.realfrom = Strophe.getBareJidFromJid(ret.from);
                    ret.realto = info.opposite;
                    ret.to = info.virtualId;
                    ret.channelid = converse.chatInfoChannelid;
                    ret.qchatid = converse.chatInfoChatid;
                }

                return ret;
            },

            // 收到访问频次太快的限制消息
            // 通过接入方配置的回调函数，做出必要的验证交互
            // 逻辑中必须要输入验证码，必须调用checkCaptchaCode来解锁消息锁定
            onOverBalance: function (message) {
                var $message = $(message);
                var from = $message.attr('from');

                if (from === 'dujia-ops' && sendMsgLock.status === false) {
                    // 执行限制发消息逻辑  
                    sendMsgLock.status = true;
                    sendMsgLock.redirectToken = $message.html();

                    // 我修改了strophe.js的内部逻辑，监听了如果消息是来自dujia-ops
                    // 且是web-overbalance的 那么消息rid自动退一，同时删除上一个重发请求
                    // 这里发送一个ping是为了继续和服务器保持通信，防止被ng的response破坏xmpp协议
                    // baotong.wang@2017-04-25
                    converse.ping();

                    if (converse.onSendMsgLock) {
                        converse.onSendMsgLock();
                    } else {
                        alert('您发送消息过于频繁，请配置onSendMsgLock回调做验证码校验');
                    }
                }
            },

            // 封装的验证码校验逻辑，校验完成通过onMsgLockCheck回调通知客户端
            // 结果：true-校验成功；false-校验失败；-1-网络错误
            checkCaptchaCode: function (code) {
                if (!code) {
                    return false;
                }

                var self = this;

                return $.ajax({
                    url: '/check_captcha',
                    type: 'get',
                    dataType: 'json',
                    data: {
                        code: code,
                        from: converse.myId,
                        redirect: decodeURIComponent(sendMsgLock.redirectToken)
                    },
                    success: function (resp) {
                        var result = resp ? !!resp.ret : false;
                        converse.onMsgLockCheck && converse.onMsgLockCheck(result);
                        sendMsgLock.status = !result;
                    },
                    error: function () {
                        converse.onMsgLockCheck && converse.onMsgLockCheck(-1);
                    }
                })
            },

            checkCard: function (strid, isUnknownTarget) {
                if (converse.stridContainer[strid]) {
                    return true;
                }

                var contact = converse.stridContainer[strid] = {
                    msgCount: 0,
                    msgIds: [],
                    isNewConnect: isUnknownTarget,
                    historyTime: new Date().getTime() / 1000
                }

                converse.chatDeffered.done($.proxy(function () {
                    contact.cardDeffered = this.getCard(strid);
                }, this));

                return false;
            },

            onNormalMessage: function (message, type) {
                var self = this;
                var $message = $(message),
                    from = $message.attr('from'),
                    to = $message.attr('to');

                var strid = Strophe.getNodeFromJid(from),
                    fromId = Strophe.getBareJidFromJid(from),
                    stridDomain = Strophe.getDomainFromJid(from),
                    resource = Strophe.getResourceFromJid(from);

                var isExist = this.checkCard(strid, true);

                var chatInfo = converse.contactsCache[strid] || converse.contactsCache[fromId] || {};

                if (type === 'readmark') {
                    converse.onReadmarkCallback && converse.onReadmarkCallback({
                        $message: $message,
                        from: from,
                        to: to,
                        topType: 'readmark',
                        id: JSON.parse($message.find('body').html())
                    }, true);
                    return;
                }

                chatInfo.type = type;
                chatInfo.domain = stridDomain;
                // 对方fromId -- 需要移除source -- 否则无法转发
                chatInfo.opposite = fromId;
                // 一般情况下等于bare_jid, converse.jid
                chatInfo.myId = Strophe.getBareJidFromJid(to);
                chatInfo.resource = resource;

                converse.contactsCache[strid] = converse.contactsCache[fromId] = chatInfo;

                var contact = converse.stridContainer[strid] || null;

                if (contact && contact.cardDeffered) {
                    contact.cardDeffered.always(function () {
                        self.onMessage(message, from, to);
                    });
                } else {
                    this.onMessage(message, from, to);
                }
            },

            onConsultMessage: function (message) {
                var $message = $(message);
                var self = this;

                var from = $message.attr('from'),
                    to = $message.attr('to'),
                    realfrom = $message.attr('realfrom'),
                    realto = $message.attr('realto');

                var strid = Strophe.getNodeFromJid(realfrom),
                    fromId = Strophe.getBareJidFromJid(realfrom),
                    stridDomain = Strophe.getDomainFromJid(realfrom),
                    virtualId = Strophe.getNodeFromJid(from),
                    resource = Strophe.getResourceFromJid(realfrom);

                var isExist = this.checkCard(strid, true);

                var chatInfo = converse.contactsCache[strid] || converse.contactsCache[fromId] || {};
                chatInfo.type = 'consult';
                chatInfo.domain = stridDomain;
                // 对方账号
                chatInfo.opposite = fromId;
                // 我的账号
                chatInfo.myId = Strophe.getBareJidFromJid(realto);
                // 本次聊天虚拟账号
                chatInfo.virtualId = from;
                chatInfo.resource = resource;

                converse.contactsCache[strid] = converse.contactsCache[fromId] = chatInfo;

                var contact = converse.stridContainer[strid] || null;

                if (contact && contact.cardDeffered) {
                    contact.cardDeffered.always(function () {
                        self.onMessage(message, realfrom, realto, virtualId);
                    })
                } else {
                    this.onMessage(message, realfrom, realto, virtualId);
                }
            },

            // 检查过来的消息是否有自定义属性
            checkCCText: function (msg, strid, isHistory) {
                if (converse.checkCCText) {
                    converse.checkCCText(msg, strid, isHistory);
                    return;
                }
                var ccText = msg.$message.attr('cctext');

                // 如果是历史消息，不更新本地缓存
                if (isHistory) {
                    ccText && (msg.cctext = ccText);

                    return;
                }

                var contact = converse.contactsCache[strid];

                // 如果对方发了cctext，且本地有缓存，删除本地的cctext
                // 理论上双方要么只有一方发送，要么双方应该保持一致
                // 同时在一个绘画期间这个值应该都是一样的
                if (!ccText && contact && contact.cctext) {
                    delete contact.cctext
                }

                // 不存在，或存在不相等；则覆盖，使用对方传入的最新的
                if (ccText && contact && (!contact.cctext || contact.cctext !== ccText)) {
                    contact.cctext = ccText;
                }

                ccText && (msg.cctext = ccText);
            },

            onMessage: function (message, from, to, virtualId) {
                /* Handler method for all incoming single-user chat "message" stanzas.*/
                var $message = $(message);

                var $forwarded, $received, $sent,
                    $body = $message.children('body'),
                    msgid = $body.attr('id'),
                    msgType = $body.attr('msgType'),
                    is_carbon = !!$message.attr('carbon_message'),
                    resource,
                    message_from = from,
                    message_to = to;

                // 如果消息不是发给我的 且不是抄送消息的，忽略
                if (!_.contains([converse.connection.jid, converse.bare_jid], message_to) && is_carbon !== true) {
                    // Ignore messages sent to a different resource
                    return true;
                }

                // 消息是我发出去的，认为是forward message
                if (message_from === converse.connection.jid) {
                    // FIXME: Forwarded messages should be sent to specific resources,
                    // not broadcasted
                    return true;
                }

                $forwarded = $message.children('forwarded');
                $received = $message.children('received[xmlns="urn:xmpp:carbons:2"]');
                $sent = $message.children('sent[xmlns="urn:xmpp:carbons:2"]');

                if ($forwarded.length) {
                    $message = $forwarded.children('message');
                } else if ($received.length) {
                    $message = $received.children('forwarded').children('message');
                } else if ($sent.length) {
                    $message = $sent.children('forwarded').children('message');
                }

                var from = Strophe.getBareJidFromJid(message_from),
                    to = Strophe.getBareJidFromJid(message_to);

                var strid;
                if (from == converse.bare_jid) {
                    // I am the sender, so this must be a forwarded message...
                    strid = to;
                    resource = Strophe.getResourceFromJid(message_to);
                } else {
                    strid = from; // XXX: Should we add toLowerCase here? See ticket #234
                    resource = Strophe.getResourceFromJid(message_from);
                }
                strid = Strophe.getNodeFromJid(strid);

                var ifCorrect = !!converse.contactsCache[strid];

                var isNewConnect = converse.stridContainer[strid] ? converse.stridContainer[strid].isNewConnect : undefined;
                if (isNewConnect) {
                    converse.stridContainer[strid].isNewConnect = false;
                }

                var contact = converse.stridContainer[strid];

                //判重
                if (msgid) {
                    if (contact.msgIds.indexOf(msgid) > -1) {
                        return true; // We already have this message stored.
                    } else {
                        contact.msgIds.push(msgid);
                    }
                }

                // 如果是当前联系人过来消息，调用已读回调
                // 如果不是判断是否是新进联系人，不是的话消息数累加
                // 如果是新近，标记新近状态
                if (strid === converse.strid) {
                    // 这里接收到了消息就返回已读标识
                    this.messageAlreadyRead(false, [msgid]);
                    contact.msgCount = 0;
                } else {
                    contact.msgCount++;
                }

                // 发送已收到
                this.messageAlreadyRead(false, [msgid], 3);

                if (!ifCorrect) {
                    converse.log("not correct jid");
                    return;
                }

                if (from !== converse.bare_jid && converse.onPlayNotificationCallback) {
                    //todo 声音
                    converse.onPlayNotificationCallback();
                }

                var msg = this.buildMessage({
                    $message: $message,
                    fromId: strid,
                    contact: contact,
                    virtualId: virtualId,
                    isNewConnect: isNewConnect
                });

                this.receiveMessage(msg);
                converse.log("onMessage:" + $message);
                return true;
            },

            onPresence: function (presence) {
                if (presence) {
                    var pre = $(presence),
                        xmlns = pre.attr('xmlns'),
                        type = pre.attr('type'),
                        category = pre.attr('category');

                    if (type === 'notify') {
                        var data = JSON.parse(pre.attr('data') || null);
                        var message = [{
                            message: data,
                            msgType: 'notify',
                            category: category
                        }];
                        converse.onMsgCallback(message, true);
                        return;
                    }

                    switch (xmlns) {
                        case 'http://jabber.org/protocol/muc#del_register':
                            var from = pre.attr('from'),
                                del_jid = pre.attr('del_jid'),
                                strid = del_jid.split('@').length > 0 ? del_jid.split('@')[0] : del_jid;
                            if (from === converse.gid + '@' + converse.ornamental) {
                                converse.onMemberChange.call(converse.runContext, strid, converse.stridContainer, '-1');
                            }
                            break;
                        case 'http://jabber.org/protocol/muc#invite':
                            var from = pre.attr('from'),
                                invite_jid = pre.attr('invite_jid'),
                                jid = invite_jid.split('@'),
                                strid = jid.length > 0 ? jid[0] : '',
                                domain = jid.length > 1 ? jid[1] : '',
                                arr = [],
                                item = {},
                                exist = false,
                                index;
                            if (from === converse.gid + '@' + converse.ornamental) {
                                converse.stridContainer.some(function (v, i) {
                                    if (v.username == strid) {
                                        exist = true;
                                        index = i;
                                        return true;
                                    }
                                });
                                if (exist) {
                                    converse.onCard(converse.stridContainer[index]);
                                    converse.onMemberChange.call(converse.runContext, converse.stridContainer[index], converse.stridContainer, '1');
                                } else {
                                    item = {
                                        domain: domain,
                                        users: [{
                                            user: strid,
                                            version: '0'
                                        }]
                                    };
                                    arr.push(item);
                                    this.getVcardForNewJoin(arr);
                                }
                            }
                            break;
                        case 'http://jabber.org/protocol/muc#vcard_update':
                            var from = pre.attr('from'),
                                $vcard = pre.find('vcard_updte'),
                                title = $vcard.attr('title');
                            if (from === converse.gid + '@' + converse.ornamental && title != converse.groupnotice) {
                                converse.groupnotice = title;
                                converse.updateNotice(title);
                            }
                            break;
                        case 'config:xmpp:time_key':
                            var key = pre.attr('key_value');
                            // 收到这个key之后才能收发消息
                            // 先获取token
                            // 建立和qchat服务器的连接
                            // 服务器给出key，chat ready
                            // 后续收发消息都依赖这个key
                            if (key) {
                                converse.key = key;
                                converse.chatDeffered.resolve();
                                converse.onChatReady && converse.onChatReady(converse.myId, converse.key);
                            }
                            break;
                        default:
                            break;
                    }
                }
            },

            onGroupMessage: function (message) {
                /* Handler method for all incoming single-user chat "message" stanzas.
                 */
                var $message = $(message);
                msgid = $message.children('body').attr('id'),
                    message_from = $message.attr('from'),
                    message_from_bare = message_from ? message_from.split("/")[1] : '';

                if (message_from_bare === converse.myId) {
                    // FIXME: Forwarded messages should be sent to specific resources,
                    // not broadcasted
                    return true;
                }

                //判重
                if (msgid) {
                    if (converse.msgIds.indexOf(msgid) > -1) {
                        return true; // We already have this message stored.
                    } else {
                        converse.msgIds.push(msgid);
                    }
                }

                this.receiveGroupMessage($message, message_from_bare);
                return true;
            },

            /*
             * data = {
             *     $message: [jquery object],
             *     fromId: [string],
             *     contact: [object],
             *     virtualId: [string],
             *     isNewConnect: [boolean],
             *     isHistoryMsg: [boolean]
             * }
             */
            buildMessage: function (data) {
                var $message = data.$message,
                    fromId = data.fromId,
                    contact = data.contact,
                    virtualId = data.virtualId,
                    isNewConnect = data ? data.isNewConnect : undefined,
                    isHistoryMsg = data.isHistoryMsg,
                    $body = $message.find('body'),
                    topType = $message.attr('type').toLowerCase(),
                    msgType = $body.attr('msgType');

                if (topType == 'note' || topType == 'transfer' || !msgType) {
                    return null;
                }

                fromId = converse.getNameFormStrid(fromId);

                var $x = $message.find('x'),
                    is_carbon = !!$message.attr('carbon_message'),
                    fullname = (converse.stridContainer && converse.stridContainer[fromId] && converse.stridContainer[fromId].chatName) || fromId,
                    imageUrl = converse.stridContainer && converse.stridContainer[fromId] && converse.stridContainer[fromId].chatImage,
                    chat_state = $message.find(COMPOSING).length && COMPOSING ||
                        $message.find(PAUSED).length && PAUSED ||
                        $message.find(INACTIVE).length && INACTIVE ||
                        $message.find(ACTIVE).length && ACTIVE ||
                        $message.find(GONE).length && GONE,
                    stamp;

                var realFrom = $message.attr('realfrom') || $message.attr('from') || '',
                    realTo = $message.attr('realto') || $message.attr('to') || '';

                realFrom = Strophe.getNodeFromJid(realFrom) || realFrom;
                realTo = Strophe.getNodeFromJid(realTo) || realTo;

                var msg = {
                    topType: topType,
                    chat_state: chat_state,
                    msgType: msgType,
                    maType: $body.attr('maType'),
                    message: $body.text(),
                    msgid: $body.attr('id'),
                    extendInfo: $body.attr('extendInfo'),
                    delayed: $message.find('delay').length > 0,
                    from: virtualId || realFrom,
                    to: realTo,
                    isNewConnect: isNewConnect,
                    $message: $message
                }

                if (virtualId) {
                    msg.realFrom = realFrom;
                }

                if (contact) {
                    msg.unreadCount = contact.msgCount;
                }

                msg.stamp = +$message.attr('msec_times');

                if (msg.from == converse.bare_jid || msg.from == converse.myId || is_carbon) {
                    msg.sender = 'me';
                    fullname = converse.myName;
                    imageUrl = converse.myImage;
                } else {
                    msg.sender = 'them';
                    imageUrl = contact.chatImage || converse.defaultChatImage;
                }

                msg.fullname = fullname;
                msg.imageUrl = imageUrl;

                // 检查消息是否是转接消息或其他历史消息，
                // 然后添加对应字段和数据到消息中，以支撑以后可能的变更
                this.messageCheck(msg, fromId, isHistoryMsg);

                return msg;
            },

            createGroupMessage: function ($message, strid) {
                var $body = $message.children('body'),
                    body = $body.text(),
                    msgType = $body.attr('msgType'),
                    extendInfo = $body.attr('extendInfo'),
                    delayed = $message.find('delay').length > 0,
                    x = $message.find('x').length > 0,
                    fullname = '',
                    imageUrl = '',
                    msgid = $body.attr('id'),
                    chat_state = $message.find(COMPOSING).length && COMPOSING ||
                        $message.find(PAUSED).length && PAUSED ||
                        $message.find(INACTIVE).length && INACTIVE ||
                        $message.find(ACTIVE).length && ACTIVE ||
                        $message.find(GONE).length && GONE,
                    stamp = +$message.attr('msec_times');

                if (converse.isNotEmpty(converse.stridContainer)) {
                    converse.stridContainer.forEach(function (v, i) {
                        if ((v.nickname && v.nickname == strid) || (v.username && v.username == strid)) {
                            fullname = v.nickname;
                            imageUrl = v.imageurl;
                        }
                    });
                }

                if (!fullname) {
                    fullname = strid;
                }

                if (converse.onMsgCallback) {
                    converse.onMsgCallback([{
                        chat_state: chat_state,
                        delayed: delayed,
                        fullname: fullname,
                        message: body || undefined,
                        msgType: msgType,
                        maType: converse.maType,
                        msgid: msgid,
                        sender: 'them',
                        time: stamp,
                        imageUrl: imageUrl,
                        from: strid,
                        mark: strid,
                        extendInfo: extendInfo
                    }], true);
                }
            },

            // 检查一些特殊消息
            messageCheck: function (msg, strid, isHistoryMsg) {
                // 这里的msgType是消息body上的msgType
                if (!msg) {
                    return
                }

                // 检查是否有自定义消息 - 每条都检查
                this.checkCCText(msg, strid, isHistoryMsg);

                switch (msg.msgType) {
                    case '1001':
                        // 会话转义
                        msg.isTransferMsg = true;
                        var transferData = JSON.parse(msg.message);
                        msg.transferInfo = {
                            reason: transferData.TransReson,
                            oldId: Strophe.getNodeFromJid(strid),
                            oldName: transferData.realfromIdNickName,
                            newId: Strophe.getNodeFromJid(transferData.realtoId),
                            newName: transferData.realtoIdNickName,
                            virtualId: transferData.toId
                        }
                        // 如果历史消息里有1001，就不要发了
                        !isHistoryMsg && this.transferReplyMessage(msg.$message, transferData, msg.message);
                        break;
                    // 逻辑结束消息
                    case '1100':
                        msg.isEndMsg = true;
                        break;
                }
            },
            /*
             *  回复移接消息并设置变更参数
             *  转接消息类型：1001
             */
            transferReplyMessage: function ($message, transferData, originMsg) {
                if (!transferData) return;
                /*
                * 发送转移回复消息
                * 注：和后端约定收到一个转移消息，需回复消息表示已收到
                */
                this.sendMessageStanza(originMsg, 1003, 1);

                //重新设置realto,获取转接数据
                // var body_txt = $message.find('body').text();
                // {
                //     "TransReson": "test 转移", 
                //     "realtoId": "laserhenry", 
                //     "toId":"虚拟id",
                //     "realfromIdNickName":"",
                //     "realtoIdNickName":""
                // }
                this.setTransferedChatInfo(transferData.realtoId, Strophe.getNodeFromJid(transferData.toId) || transferData.toId);
            },

            receiveMessage: function (msg) {
                if (msg.message) {
                    if (msg.topType === "Transfer") {
                        var jsonVal = eval('(' + msg.message + ')');
                        converse.chatJid = jsonVal.TransId + "@" + converse.toDomain;
                        var TransReson = jsonVal.TransReson;
                        if (!converse.isPreference) {
                            converse.stridContainer = {};
                        }
                        converse.stridContainer[jsonVal.TransId] = {
                            chatName: jsonVal.TransId,
                            chatImage: ''
                        };
                        converse.chatBox.getVcard(jsonVal.TransId);
                        this.sendMessage(TransReson);
                    } else {
                        if (msg.sender != 'me' && converse.windowState == 'blur') {
                            converse.incrementMsgCounter();
                        }

                        converse.onMsgCallback && converse.onMsgCallback([msg], true);
                    }
                }
            },

            receiveGroupMessage: function ($message, strid) {
                var $body = $message.children('body');
                var text = ($body.length > 0 ? $body.text() : undefined);
                if (text) {
                    this.createGroupMessage($message, strid);
                }
            },
            // 会话转移，qchat端发起，前端被动接收到消息做一些展示调整（更新头像、用户名等）
            sessionTransfer: function (strid) {
                if (strid) {
                    converse.chatJid = strid + "@" + converse.toDomain;
                    converse.chatBox.getVcard(strid);
                    converse.stridContainer[strid] = {};
                }
            },

            //取历史消息
            fetchHistoryMsg: function (pageSize, strid, ifFirst) {
                var self = this;

                if (typeof strid === 'boolean') {
                    ifFirst = strid;
                    strid = null;
                }

                var historyStrid = strid || converse.strid || null;

                if (!historyStrid || this.historyLoading) {
                    return
                }

                var contact = converse.stridContainer[historyStrid];
                this.historyLoading = true;
                pageSize = pageSize || 15;
                if (!contact.historyTime || ifFirst) {
                    contact.historyTime = new Date().getTime() / 1000;
                    converse.log("fucktime:begin" + contact.historyTime);
                }

                // 如果指定从第一天开始加载，则清空之前保存的数据id
                if (ifFirst) {
                    contact.msgIds = [];
                }

                var chatInfo = this.getChatInfo(converse.strid)
                var historyApi = '/package/qtapi/getmsgs.qunar', virtualParam = '';

                // if(chatInfo && chatInfo.type === 'consult') {
                //     historyApi = 'getcmsginfo1';
                //     virtualParam = '&virtual=' + Strophe.getNodeFromJid(chatInfo.to);
                // } else {
                // if(converse.isConsult) {
                //     historyApi = 'getcmsginfo';
                //     // virtualParam = '&virtual=' + Strophe.getNodeFromJid(converse.virtualId);
                // } else {
                // historyApi = 'getcmsginfo';
                // }
                // }

                var url = historyApi;
                var params = {
                    from: converse.myId,
                    to: historyStrid,
                    direction: '0' + virtualParam,
                    time: contact.historyTime,
                    domain: converse.domain,
                    num: pageSize,
                    fhost: converse.domain,
                    thost: converse.toDomain,
                    f: 't'
                };

                converse.log("historyurl:" + url);

                $.ajax({
                    url: url,
                    // type: 'get',
                    type: 'post',
                    data: JSON.stringify(params),
                    contentType: 'application/json; charset=utf-8',
                    dataType: 'json',
                    success: function (response) {
                        converse.log("history:" + JSON.stringify(response));
                        if (!response.ret) {
                            return;
                        }
                        response = response.data;
                        var haveOther = false;
                        var len = response.length;
                        var container = [];
                        var message;

                        var resData = [];
                        $.each(response, function (index, item) {
                            var msg = '<message msec_times="{msec_times}" type="{type}" from="{from}" to="{to}" isHiddenMsg="{isHiddenMsg}">';
                            msg += '<body msgType="{msgType}" maType="{maType}" id="{id}" extendInfo=' + "'{extendInfo}'" + '>{content}</body>';
                            msg += '<active xmlns="http://jabber.org/protocol/chatstates" />';
                            msg += '</message>';
                            msg = msg.replace('{msec_times}', item.message.msec_times)
                                .replace('{type}', item.message.type)
                                .replace('{from}', item.message.from)
                                .replace('{to}', item.message.to)
                                .replace('{isHiddenMsg}', item.message.isHiddenMsg)
                                .replace('{msgType}', item.body.msgType)
                                .replace('{maType}', item.body.maType)
                                .replace('{id}', item.body.id)
                                .replace('{extendInfo}', item.body.extendInfo || null)
                                .replace('{content}', item.body.content)
                                .replace('{stamp}', item.time.stamp);
                            resData.push({
                                F: item.from,
                                T: item.to,
                                R: Math.floor(item.read_flag / 2) % 2 === 1 ? '1' : '0',
                                B: msg
                            });
                        });

                        if (len > 0) {
                            this.createHistoryMessage(resData, historyStrid);

                            for (var i = len - 1; i >= 0; i--) {
                                if (resData[i]['R'] == '0' || !resData[i]['R']) {
                                    message = resData[i]["B"];
                                    message = $(message.replace("</body>", "</msgbody>").replace("<body", "<msgbody"));
                                    container.push(message);
                                }
                            }

                            if (len == pageSize) {
                                haveOther = true;
                            }
                            if (container.length > 0) {
                                self.messageAlreadyRead(container);
                            }
                        }

                        converse.onHistory({
                            hasMore: haveOther,
                            strid: historyStrid
                        }, ifFirst);
                    }.bind(this),
                    error: function (response) {
                        converse.onHistory({
                            hasMore: false,
                            strid: historyStrid
                        }, ifFirst);
                    }.bind(this),
                    complete: function () {
                        this.historyLoading = false;
                    }.bind(this)
                });
            },

            fetchGroupHistoryMsg: function (pageSize, ifFirst) {
                var ifFirst = ifFirst || false,
                    url;
                if (!pageSize) {
                    pageSize = 15;
                }
                if (!converse.historyTime) {
                    converse.historyTime = new Date().getTime() / 1000;
                }
                url = '/package/qtapi/getmucmsgs.qunar';
                $.ajax({
                    url: url,
                    type: 'POST',
                    dataType: "json",
                    contentType: 'application/json; charset=utf-8',
                    data: JSON.stringify({
                        muc: converse.gid,
                        time: converse.historyTime,
                        direction: '0',
                        num: pageSize,
                        domain: converse.ornamental
                    }),
                    success: function (data) {
                        if (data.ret && data.data && data.data.Msg) {
                            var response = data.data.Msg,
                                haveOther = false,
                                len = response.length;
                            if (len > 0) {
                                for (var i = len - 1; i >= 0; i--) {
                                    this.createGroupHistoryMessage(response[i], i == 0);
                                }
                                if (len == pageSize) {
                                    haveOther = true;
                                }
                            }
                            if (converse.runContext) {
                                converse.onHistory.call(converse.runContext, {
                                    hasMore: haveOther
                                }, ifFirst);
                            } else {
                                converse.onHistory({
                                    hasMore: haveOther
                                }, ifFirst);
                            }
                        }
                    }.bind(this),
                    error: function (response) {
                        if (converse.runContext) {
                            converse.onHistory.call(converse.runContext, {
                                hasMore: false
                            }, ifFirst);
                        } else {
                            converse.onHistory({
                                hasMore: haveOther
                            }, ifFirst);
                        }
                    }.bind(this)
                });
            },

            createHistoryMessage: function (msgs, historyStrid) {
                var isSetTime;
                var msg;
                var results = [];
                var contact = converse.stridContainer[historyStrid];

                for (var i = 0, xmlNode, $message, msgObj; i < msgs.length; i++) {
                    msg = msgs[i];
                    isSetTime = i == 0;
                    // 通过以下方式将xml转为jquery可以操作的node
                    try {
                        xmlNode = $.parseXML(msg['B']);
                    } catch (e) {
                        continue;
                    }
                    $message = $(xmlNode.getElementsByTagName('*')[0]);

                    msgObj = this.buildMessage({
                        $message: $message,
                        fromId: historyStrid,
                        contact: true,
                        isHistoryMsg: true
                    });

                    if (isSetTime && $message.attr('isHiddenMsg') === '1') {
                        // 记录时间最久的一条消息时间
                        contact.historyTime = moment.utc(msgObj.stamp).unix();
                        converse.log("fucktime:" + msgObj.stamp + "," + converse.contact);
                        // skip the message that should not show up
                        continue
                    }

                    if (!msgObj || msgObj.isEndMsg) {
                        continue
                    }

                    msgObj.isRead = msg['R'] === '1';
                    msgObj.history = 1;

                    if (isSetTime) {
                        contact.historyTime = moment.utc(msgObj.stamp).unix();
                        converse.log("fucktime:" + msgObj.stamp + "," + contact.historyTime);
                    }

                    if (msgObj.msgid) {
                        if (contact.msgIds.indexOf(msgObj.msgid) > -1) {
                            continue
                        } else {
                            contact.msgIds.push(msgObj.msgid);
                        }
                    }

                    results.push(msgObj);
                }

                converse.onMsgCallback(results);
            },
            createGroupHistoryMessage: function (msg, isSetTime) {
                var message = msg["B"].replace("</body>", "</msgbody>").replace("<body", "<msgbody"),
                    $message = $(message),
                    browser = navigator.appName,
                    b_version = navigator.appVersion,
                    version = b_version.split(";");

                if (browser == "Microsoft Internet Explorer" && version.length > 1) {
                    var trim_Version = parseInt(version[1].replace(/[ ]/g, "").replace(/MSIE/g, ""));
                    if (trim_Version < 9) {
                        var xml = new ActiveXObject("Microsoft.XMLDOM");
                        xml.async = false;
                        xml.loadXML(message);
                        $message = $(xml).children('message');
                    }
                }

                var $body = $message.children('msgbody'),
                    type = $message.attr('type'),
                    body = $body.text(),
                    extendInfo = $body.attr('extendInfo'),
                    msgType = $body.attr('msgType'),
                    maType = $body.attr('maType'),
                    msgid = $body.attr('id'),
                    delayed = $message.find('delay').length > 0,
                    x = $message.find('x').length > 0,
                    sender, imageUrl, fullname;

                stamp = +$message.attr('msec_times')

                if (isSetTime) {
                    converse.historyTime = moment.utc(stamp).unix();
                    converse.log("fucktime:" + stamp + "," + converse.historyTime);
                }

                if (msgid) {
                    if (converse.msgIds.indexOf(msgid) > -1) {
                        return true; // We already have this message stored.
                    } else {
                        converse.msgIds.push(msgid);
                    }
                }

                if (msg["N"] == converse.myId) {
                    sender = 'me';
                } else {
                    sender = 'them';
                }

                if (converse.isNotEmpty(converse.stridContainer)) {
                    converse.stridContainer.forEach(function (v, i) {
                        if ((v.nickname && v.nickname == msg["N"]) || (v.username && v.username == msg["N"])) {
                            fullname = v.nickname;
                            imageUrl = v.imageurl;
                        }
                    });
                }

                if (!fullname) {
                    fullname = msg["N"] || '';
                }

                if (!imageUrl) {
                    imageUrl = converse.defaultChatImage;
                }

                var hm = {
                    fullname: fullname,
                    message: body || "",
                    msgType: msgType,
                    maType: maType,
                    sender: sender,
                    imageUrl: imageUrl,
                    time: stamp,
                    history: 1,
                    mark: msg["N"],
                    extendInfo: extendInfo
                };

                if (!msgType || type == "note" || type == "Transfer") {
                    return;
                }

                converse.onMsgCallback([hm]);
            },

            getCard: function (strid) {
                // 对于qtalk所在服务器，使用qtalk获取用户信息的接口
                if (converse.toDomain === 'ejabhost1') {
                    return this.getQtalkVcard(strid);
                } else {
                    return this.getVcard(strid);
                }
            },
            getVcard: function (strid) {
                //统一使用一个接口
                var args = [{
                    domain: converse.domain,
                    users: [{
                        user: strid,
                        version: '0'
                    }]
                }];
                var config = {
                    url: '/newapi/domain/get_vcard_info.qunar?u=' + converse.myId + '&k=' + converse.key,
                    type: 'post',
                    dataType: 'json',
                    contentType: 'application/json',
                    xhrFields: {
                        withCredentials: true
                     },
                    crossDomain: true,
                    data: JSON.stringify(args)
                };

                var deffered = $.ajax($.extend(config, {
                    success: function (resp) {
                        converse.log("vcard:" + JSON.stringify(resp));

                        var card;
                        if (resp.ret && resp.data.length) {
                            card = resp.data[0].users.length ? resp.data[0].users[0] : null;

                            if (!card) return;
                            var contact = converse.stridContainer[strid];

                            if (strid == converse.myId) {
                                converse.myName = card.username;
                                converse.myImage = card.imageurl;
                                converse.onCard(card, true);
                                converse.myNickName = card.nickname;
                                converse.myWebName = card.webname || '';
                            } else {
                                // converse.chatName = card.webname ? card.webname : card.username;
                                // converse.chatImage = card.imageurl;
                                converse.onCard(card, false, converse.shopName);

                                if (contact) {
                                    contact.chatName = card.webname || card.nickname;
                                    contact.chatImage = card.imageurl;
                                }
                            }
                        }
                    },
                    error: function (error) { }
                }));

                return deffered;
            },
            getQtalkVcard: function (strid) {
                var args = [{
                    domain: 'ejabhost1',
                    users: [{
                        user: strid,
                        version: '0'
                    }]
                }];
                var config = {
                    url: '/newapi/domain/get_vcard_info.qunar?u=' + converse.myId + '&k=' + converse.key,
                    type: 'post',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify(args)
                };

                var deffered = $.ajax($.extend(config, {
                    success: function (resp) {
                        converse.log("vcard:" + JSON.stringify(resp));
                        var card;

                        if (resp.ret && resp.data.length) {
                            card = resp.data[0].users.length ? resp.data[0].users[0] : null;

                            if (!card) return;
                            var contact = converse.stridContainer[strid];

                            if (strid == converse.myId) {
                                converse.myName = card.username;
                                converse.myImage = card.imageurl;
                                converse.onCard(card, true);
                                converse.myNickName = card.nickname;
                                converse.myWebName = card.webname || '';
                            } else {
                                // converse.chatName = card.webname ? card.webname : card.username;
                                // converse.chatImage = card.imageurl;
                                converse.onCard(card, false);

                                if (contact) {
                                    contact.chatName = card.nickname ? card.nickname : card.webname;
                                    contact.chatImage = card.imageurl;
                                }
                            }
                        }
                    },
                    error: function (error) { }
                }));

                return deffered;
            },
            sendServiceMsg: function () {
                if (!_.isEmpty(converse.bu_name) && !_.isEmpty(converse.service_type) && !_.isEmpty(converse.service_url) || converse.bu_name == 'cheche' && !_.isEmpty(converse.service_type)) {
                    var timestamp = (new Date()).getTime();

                    if (!converse.strid) {
                        converse.log('No contact specified');
                        return
                    }

                    var msg = {
                        "bu": converse.bu_name,
                        "type": converse.service_type,
                        "url": converse.service_url,
                        "webname": converse.myWebName,
                        "nickname": converse.myNickName,
                        "ip": converse.ipAddress
                    };

                    msg = JSON.stringify(msg); //转为json字符串
                    var chatInfo = this.getChatInfo(converse.strid);
                    if (!chatInfo) {
                        return false;
                    }

                    chatInfo.type = 'note';

                    var message = $msg(chatInfo).c('body', {
                        id: timestamp,
                        msgType: '11',
                        maType: converse.maType,
                    }).t(msg).up().c(ACTIVE, {
                        'xmlns': Strophe.NS.CHATSTATES
                    });

                    //converse.connection.send(message);                    

                    if (converse.forward_messages) {
                        // Forward the message, so that other connected resources are also aware of it.
                        var forwarded = $msg({
                            to: converse.bare_jid,
                            type: 'note'
                        })
                            .c('forwarded', {
                                xmlns: 'urn:xmpp:forward:0'
                            })
                            .c('delay', {
                                xmns: 'urn:xmpp:delay',
                                stamp: timestamp
                            }).up()
                            .cnode(message.tree());
                        converse.connection.send(forwarded);
                    };

                    //获取产品详情信息                        
                    if (converse.onGetProductDetailCallback) {
                        converse.onGetProductDetailCallback();
                    }
                }
            },
            messageAlreadyRead: function (data, ids, read_type) {
                var item, text, tag, container = [],
                    i, msgbody, from, to, extendInfo;

                if (data && data.length > 0) {
                    for (i = 0; i < data.length; i++) {
                        item = {};
                        msgbody = data[i].find('msgbody');
                        item.id = msgbody && msgbody.attr('id');
                        container.push(item);
                    }

                } else if ($.isArray(ids)) {
                    $.each(ids, function (index, id) {
                        container.push({
                            id: id
                        })
                    })
                }

                text = JSON.stringify(container);
                // todo.. 如果是consult的时候 我这里该怎么发？？
                from = (converse.connection.jid && converse.connection.jid.replace(/\/.*/, '')) || '';
                to = converse.chatJid;
                tag = $msg({
                    type: "readmark",
                    read_type: read_type || "4",
                    from: from,
                    to: to
                })
                    .c('body', {
                        msgType: 1,
                        maType: 3
                    }).t(text);

                converse.connection.send(tag);
            },
            allMessageRead: function (strid) {
                var contact = converse.stridContainer[strid];

                if (contact && contact.msgCount && contact.msgIds.length) {
                    this.messageAlreadyRead(false, contact.msgIds.slice(0));
                    contact.msgCount = 0;
                    contact.msgIds = [];
                }
            },

            sendMessageStanza: function (text, msgType, isHiddenMsg) {
                /* Sends the actual XML stanza to the XMPP server.
                 */
                // TODO: Look in ChatPartners to see what resources we have for the recipient.
                // if we have one resource, we sent to only that resources, if we have multiple
                // we send to the bare jid.
                if (!converse.strid) {
                    converse.log('No contact specified');
                    return
                }

                var self = this;
                var timestamp = (new Date()).getTime();
                var uuid = this.createUUID();
                // 扩展参数
                var extendAttr;
                if (typeof isHiddenMsg !== 'boolean' && typeof isHiddenMsg === 'object') {
                    extendAttr = isHiddenMsg;
                    isHiddenMsg = false;
                }

                if (arguments.length === 4) {
                    extendAttr = arguments[3];
                }

                var chatInfo = this.getChatInfo(converse.strid);
                if (!chatInfo) {
                    console.log('strid not exist');
                    return false;
                }

                chatInfo.type = 'chat';
                chatInfo.isHiddenMsg = isHiddenMsg ? '1' : '0';

                if (chatInfo.realfrom && chatInfo.realto) {
                    chatInfo.type = 'consult';
                    chatInfo.channelid = converse.chatInfoChannelid;
                    chatInfo.qchatid = converse.chatInfoChatid;
                }

                var body = {
                    msgType: msgType,
                    maType: converse.maType,
                    id: uuid
                };
                converse.backupinfo && (body.backupinfo = JSON.stringify(converse.backupinfo));

                var extendAttrDetail;
                for (var key in extendAttr) {
                    if (key === 'msgType' || key === 'maType' || key === 'id') {
                        continue
                    }

                    extendAttrDetail = extendAttr[key]

                    // 需要放到message标签发出去的属性
                    // position决定附加属性放在哪里
                    if (extendAttrDetail.position && extendAttrDetail.position === 'message') {
                        delete extendAttrDetail.position
                        chatInfo[key] = JSON.stringify(extendAttrDetail);
                    } else {
                        // 普通放到body标签中发的属性
                        body[key] = JSON.stringify(extendAttr[key]);
                    }
                }

                var message = $msg(chatInfo).c('body', body).t(text).up().c(ACTIVE, {
                    'xmlns': Strophe.NS.CHATSTATES
                });

                converse.connection.send(message);

                if (converse.forward_messages) {
                    // Forward the message, so that other connected resources are also aware of it.
                    var forwarded = $msg({
                        to: converse.bare_jid,
                        type: 'chat',
                        id: uuid
                    })
                        .c('forwarded', {
                            xmlns: 'urn:xmpp:forward:0'
                        })
                        .c('delay', {
                            xmns: 'urn:xmpp:delay',
                            stamp: timestamp
                        }).up()
                        .cnode(message.tree());
                    converse.connection.send(forwarded);
                }

                return uuid;
            },

            sendGroupMessageStanza: function (text, msgType) {
                var uuid = this.createUUID(),
                    bare_jid = converse.gid + '@' + converse.ornamental,
                    message = $msg({
                        from: converse.connection.jid,
                        to: bare_jid,
                        type: 'groupchat'
                    })
                        .c('body', {
                            msgType: msgType,
                            id: uuid
                        }).t(text).up()
                        .c(ACTIVE, {
                            'xmlns': Strophe.NS.CHATSTATES
                        });
                converse.connection.send(message);

                return true;
            },

            createUUID: function () {
                var d = new Date().getTime();
                var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = (d + Math.random() * 16) % 16 | 0;
                    d = Math.floor(d / 16);
                    return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
                });
                return uuid.toUpperCase();
            },

            sendEndMessage: function () {
                return this.sendMessage('QchatEnd', '1100', true);
            },

            sendMessage: function (text, msgType, isHiddenMsg) {
                if (_.isEmpty(text)) {
                    throw new Error("sendMessge: the message can't be empty");
                }

                if (!converse.connection.authenticated) {
                    converse.renderLoginPanel('not autuehticated');
                    return false;
                }

                if (!msgType) {
                    msgType = '1';
                }

                return this.sendMessageStanza(text, msgType, isHiddenMsg);
            },

            sendGroupMessage: function (text, msgType) {
                if (_.isEmpty(text)) {
                    throw new Error("sendMessge: the message can't be empty");
                }
                if (!converse.connection.authenticated) {
                    converse.renderLoginPanel('not authenticated');
                    return false;
                }

                if (!msgType) {
                    msgType = '1';
                }

                this.sendGroupMessageStanza(text, msgType);
                return true;
            },

            /* 发送订单信息给后端 qchat不需要显示*/
            sendOrderMessage: function (jsonObj, isHiddenMsg) {
                if (!converse.strid) {
                    converse.log('No contact specified.');
                    return
                }

                var self = this;
                var timestamp = (new Date()).getTime();
                var uuid = this.createUUID();

                //body里面必须要有内容，不然消息会被服务器过滤掉,android会收不到。所以需要增加这是之前的内容
                var bodyContent = '来生意了，升级高版本查看该消息详情，地址: ' + jsonObj.detailurl || "";
                var jsonStrContent = JSON.stringify(jsonObj);

                var chatInfo = this.getChatInfo(converse.strid);

                if (!chatInfo) {
                    console.log('strid not exist');
                    return false;
                }

                //touch端默认不显示
                if (typeof isHiddenMsg == "undefined") {
                    chatInfo.isHiddenMsg = "1";
                }

                var message = $msg(chatInfo).c('body', {
                    msgType: "888",
                    maType: "3",
                    extendInfo: jsonStrContent,
                    id: uuid
                }).t(bodyContent).up();

                converse.connection.send(message);
            },

            /* 发送产品详情信息给后端 note信息 qchat不需要显示*/
            sendProductInfoMessage: function (productDetail) {
                if (!productDetail || !converse.strid) {
                    return;
                }

                var timestamp = (new Date()).getTime();

                var data = {
                    data: productDetail
                };

                var msg = {
                    "bu": converse.bu_name,
                    "type": converse.service_type,
                    "url": converse.service_url,
                    "webname": converse.myWebName,
                    "nickname": converse.myNickName,
                    "ip": converse.ipAddress
                };

                //增加产品详情信息
                if (productDetail) {
                    $.extend(msg, data);
                };

                msg = JSON.stringify(msg); //转为json字符串

                var chatInfo = this.getChatInfo(converse.strid);

                //为了兼容之前发的note消息类型,现增了consult类型
                if (chatInfo.type == 'chat') {
                    chatInfo.type = 'note';
                }

                var message = $msg(chatInfo).c('body', {
                    id: timestamp,
                    msgType: '11',
                    maType: converse.maType,
                }).t(msg).up().c(ACTIVE, {
                    'xmlns': Strophe.NS.CHATSTATES
                });

                converse.connection.send(message);
            },

            close: function () {
                if (converse.connection.connected) {
                    converse.connection.disconnect();
                }
            }
        };

        this.setUpXMLLogging = function () {
            if (this.debug) {
                this.connection.xmlInput = function (body) {
                    converse.log(body);
                };
                this.connection.xmlOutput = function (body) {
                    converse.log(body);
                };
            }
        };

        this.attemptNonPreboundSession = function () {
            if (this.auto_login) {
                if (!this.jid) {
                    throw new Error("initConnection: If you use auto_login, you also need to provide a jid value");
                }
                if (this.authentication === ANONYMOUS) {
                    this.connection.connect(this.jid, null, this.onConnectStatusChanged);
                } else if (this.authentication === LOGIN) {
                    if (!this.password) {
                        throw new Error("initConnection: If you use auto_login and " +
                            "authentication='login' then you also need to provide a password.");
                    }
                    this.connection.connect(this.jid, this.password, this.onConnectStatusChanged);
                }
            }
        };

        this.initConnection = function () {
            if (this.connection && this.connection.connected) {
                this.setUpXMLLogging();
                this.onConnected();
            } else {
                if (!this.bosh_service_url) {
                    throw new Error("initConnection: you must supply a value for either the bosh_service_url");
                }
                if (this.bosh_service_url) {
                    // Strophe.Connecion 会根据 service_url 判断使用websocket还是http-bind
                    this.connection = new Strophe.Connection(this.bosh_service_url);
                } else {
                    throw new Error("initConnection: this browser does not support bosh_service_url wasn't specified.");
                }
                this.setUpXMLLogging();
                this.attemptNonPreboundSession();
            }
        };

        this._initialize = function () {
            this.initConnection();
            return this;
        };

        //第三方(匿名用户):用户名和密码聊天,不用登录
        //这两个参数是从URL地址传过来的
        this.loginForParams = function () {
            var jid = converse.virtualAcc.lname; //用户名
            var password = converse.virtualAcc.lcredence; //密码

            if (!jid || !password) {
                throw new Error("lname or lcredence  can't be empty");
            };

            if (typeof (password) == "object") {
                password = JSON.stringify(password);
            };

            var resource = "";

            if (jid) {
                jid += "@" + converse.domain;
                resource = Strophe.getResourceFromJid(jid);
                if (!resource) {
                    jid += '/web-' + Math.floor(Math.random() * 139749825).toString();
                }
            }

            converse.connection.connect(jid, password, converse.onConnectStatusChanged);
        };
        //获取URL参数
        this.getQueryString = function (name) {
            var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
            var r = window.location.search.substr(1).match(reg);
            if (r != null) return decodeURIComponent(r[2]);
            return null;
        };
        //正常用户登录
        this.loginForCookie = function () {
            var self = this,
                url, data = {},
                ajaxType;

            // 设置5次登陆尝试，每次间隔3s
            this.loginCount = this.loginCount || 0;

            if (this.loginCount === this.loginMaxTryCount) {
                return false;
            }

            this.loginCount++;

            var ajaxOption = {
                dataType: 'jsonp',
                type: 'GET',
            }

            // 用户中心登陆
            // 匿名登陆
            // 第三方账号体系登陆 - 需要qchat后端提前支持
            // 
            // 拿到token之后使用用户名 + token登陆qchat服务器
            if(false) {
                // this.isUCenter
                // 用户中心登录 -- 请求的时候根据cookie来获取token
                ajaxOption.url = converse.http_api_server + 'http_gettoken';
            } else if (true) {
                // this.isAnonymous
                //匿名登录
                //var fromHost = "startalkWeb";
                var fromHost = "web";
                ajaxOption.type = 'post';
                ajaxOption.dataType = 'json';
                ajaxOption.contentType = 'application/json; charset=utf-8';
                ajaxOption.url = '/newapi/nck/get_anony_token.qunar';
    
                data = {
                    plat: fromHost,//web
                    version: 10010,
                    gid: "",
                    uuidFlag: ""
                }
                var qn1 = document.cookie.match(/QN1=([^;\s]+)/);
                if (qn1) {
                    data.uuidFlag = Base64.encode(qn1[1]);
                }
                ajaxOption.data = JSON.stringify(data);//contentType是json，浏览器显示为payload
            } else {
                // 其他业务线登录的common接口
                ajaxOption.url = converse.http_api_server + 'mcenter/gettoken';
                ajaxOption.data = {
                    currentId: this.busiLoginId,
                    type: this.busiLoginType
                };
            }

            $.ajax($.extend(ajaxOption, {
                success: function (data) {
                    //debugger
                    converse.log("ajax suc");
                    // switchOn 匿名登录开关 否则跳到登录页
                    if (false) {
                        self.onAuthFail('Get Token (ajax) Failed.');
                    } else if (data && data.data) {
                        var _q = document.cookie && document.cookie.match(/_q=([^;\s]+)/),
                            jid = data.data.username || _q && _q.length > 1 && _q[1].substring(2),
                            token = password = data.data.token;

                        if (jid) {
                            self.onAuthDone({
                                userid: data.data.username,
                                username: data.data.username,
                                token: token,
                                name: data.data.name || '',
                                image: data.data.image || converse.defaultChatImage
                            });

                            jid += "@" + converse.domain;

                            resource = Strophe.getResourceFromJid(jid);
                            if (!resource) {
                                jid += '/web-' + Math.floor(Math.random() * 139749825).toString();
                            }
                        }

                        converse.connection.connect(jid, password, converse.onConnectStatusChanged);
                    } else {
                        if (self.loginCount < self.loginMaxTryCount) {
                            setTimeout(function () {
                                self.loginForCookie();
                            }, 1000);
                        } else {
                            self.onAuthFail('Get Token (ajax) Failed.');
                        }

                    }
                },
                error: function (error) {
                    if (self.loginCount < 5) {
                        setTimeout(function () {
                            self.loginForCookie();
                        }, 1000);
                    } else {
                        self.onAuthFail('Get Token (ajax) Failed.');
                    }
                },
                complete: function () { }
            }));
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        if (settings.connection) {
            this.connection = settings.connection;
        }
        this._initialize();
        // 注册全局回调
        this.registerGlobalEventHandlers();
        // 注册消息回调
        this.chatBox.registerMessageHandler();

        //业务线名是会场
        if (this.bu_name == "8" || this.bu_name == "huichang") {
            this.loginForParams();
        } else {
            this.loginForCookie();
        }
    };

    return {
        'initialize': function (settings, operations) {
            converse.initialize(settings, operations);
        },

        'sessionTransfer': function (strid) {
            converse.chatBox.sessionTransfer(strid);
        },
        //初始化客服列表
        //原因是之前只和一个客服聊天接收消息判断stridContainer 在代码893行，现在左边列表有客服列表同时和多个客服聊天
        //所以先初始化所有聊天的客服信息,如果有不初始化只能收到活动的那个客服信息，其它客服信息收不到了 modify@20160919
        'setStridContainer': function (strids) {
            converse.setStridContainer(strids);
        },
        // 切换联系人，更新当前聊天对象信息，前端主动触发
        'switchContact': function (strid, virtualId, host) {
            converse.chatBox.stridSpecified(strid, virtualId, host || window.nav_igator.baseaddess.domain);
        },
        'sdkSwitchContact': function (strid, virtualId, cctext) {
            converse.chatBox.stridSpecifiedWrapper(strid, virtualId, cctext);
        },
        'account': {
            'logout': function () {
                converse.chatBox.close();
            },
            'loginForCookie': function () {
                converse.loginForCookie();
            }
        },
        'settings': {
            'get': function (key) {
                if (_.contains(converse.paramx, key)) {
                    return converse[key];
                }
            },
            'set': function (key, val) {
                var o = {};
                if (typeof key === "object") {
                    _.extend(converse, _.pick(key, this.paramx));
                } else if (typeof key === "string") {
                    o[key] = val;
                    _.extend(converse, _.pick(o, this.paramx));
                }
            }
        },
        'sendMessage': function (text, msgType, isHiddenMsg) {
            if (sendMsgLock.status) {
                return false;
            }
            return converse.chatBox.sendMessage(text, msgType, isHiddenMsg);
        },
        sendEndMessage: function () {
            return converse.chatBox.sendEndMessage();
        },
        allMessageRead: function (strid) {
            return converse.chatBox.allMessageRead(strid);
        },
        getCurrentStrid: function () {
            return converse.strid || '';
        },
        /*
         * 发送订单信息给后端
         */
        'sendOrderMessage': function (jsonObj, isHiddenMsg) {
            return converse.chatBox.sendOrderMessage(jsonObj, isHiddenMsg);
        },
        /*
         * 发送产品详情信息给后端
         */
        'sendProductInfoMessage': function (productDetail) {
            return converse.chatBox.sendProductInfoMessage(productDetail);
        },

        'sendGroupMessage': function (text, msgType) {
            return converse.chatBox.sendGroupMessage(text, msgType);
        },
        'getHistory': function (pageSize, strid, ifFirst) {
            converse.chatDeffered.done(function () {
                converse.chatBox.fetchHistoryMsg(pageSize, strid, ifFirst);
            });
        },
        'getGroupHistory': function (pageSize, ifFirst) {
            converse.chatBox.fetchGroupHistoryMsg(pageSize, ifFirst);
        },

        'cleanOnChatEnd': function (strid) {
            converse.cleanOnChatEnd(strid);
        },
        checkCaptchaCode: function (code) {
            converse.chatBox.checkCaptchaCode(code);
        },
        getVcard: function (strid) {
            return converse.chatBox.getVcard(strid);
        },
        disconnect: function () {
            return converse.logOut();
        },
        'env': {
            'jQuery': $,
            'Strophe': Strophe,
            '$build': $build,
            '$iq': $iq,
            '$pres': $pres,
            '$msg': $msg,
            '_': _,
            'b64_sha1': b64_sha1
        },
        setShopName: function (shopName) {
            converse.shopName = shopName;
        }
    };
}));