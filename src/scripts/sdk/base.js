/*
 * @Author: baotong.wang
 * @Date: 2017-02-17 19:35:22
 * @Last Modified by:   wanghaowh.wang
 * @Last Modified time: 2018-02-05 10:47:27
 * @Description: qchat web SDK
 * @Dependence: jquery，需要在文件中单独引用
 */

require('lib/extension/string.js');
require('lib/extension/date.js');
var qchatCore = require('qchat/qchat-core.js');
var utils = require('utils/utils.js');
var UploadModule = require('./modules/upload.js');
var MsgHelper = require('./modules/messageHelper.js');
var Emotions = require('./modules/emotions.js');
var enums = require('./enums.js');
var config = require('./config.js');

// 域名
var domain = config.domain;
// 通用配置
var settings = config.settings;
var converse = qchatCore.converse || {};

var QchatSDK = function() {
    this.options = {
        useWebSocket: false,
        // 产品id，可以为空
        pid: '',
        // 客服id，不能为空
        strid: '',
        // 默认抄送数据
        cctext: '',
        // 客服坐席id，可以为空
        seatId: '',
        // 业务线名称
        bu_name: '',
        // 这个
        service_url: '',
        // 聊天框的ip地址
        ipAddress: '',
        // web端：6
        maType: 6,
        // 聊天类型，sdk统一都是web
        chatType: 'web',
        // 聊天类型：分为qchat、qtalk，SDK绝大部分情况下都是qchat
        targetType: enums.TargetType.QCHAT,
        // 当前登陆用户的domain，因为这是web端sdk
        domain: enums._Domain.QCHAT,
        // 聊天对象的domain，sdk面向qchat
        toDomain: enums._Domain.QCHAT,
        // 发送图片按钮的id，一个页面只有一个
        sendFileId: '',
        // 发送图片按钮的id，一个页面只有一个
        sendImageId: '',
        // 发送文件按钮的class name - 支持一个页面多个按钮
        sendFileClass: '',
        // 发送图片按钮的class name - 支持一个页面多个按钮
        sendImageClass: '',
        // 是否是用户中心登陆
        isUCenter: false,
        // 业务方登陆类型
        busiLoginType: '',
        // 业务方登陆id
        busiLoginId: '',
        // 当前业务方的虚拟账号，目前需要业务线自己设置
        virtualId: '',
        // 是否启用机器人消息，默认不启动
        enableRobot: false,
        // 机器人id
        robotStrid: '',
        // 展示收发消息
        showMessage: function() {}
    };

    // 标记是否设置了option，没设置不能init
    this.isSet = false;
    // 标记是否会话结束
    this.isChatEnd = false;

    this.callbacks = {
        checkCCText: null,
        // 收到一条消息
        onMsgCallback: function(msgArr) {},
        // 链接状态发生改变
        onStatusChangeCallback: function(args, isReconnect) {},
        // 收到用户的头像
        // 因为头像是ajax获取，如果是历史消息的话有可能不存在
        onCard: function(args) {},
        // 收到消息后播放的声音
        onPlayNotificationCallback: function() {},
        // 有新的会话进来
        onNewConnection: function() {},
        // 和服务器建立了连接
        onChatReady: function() {},
        // 会话结束
        onChatEnd: function() {},
        // 上传开始
        onUploadStart: function() {},
        // 上传进行中
        onUploadProgress: function(progress, percent) {},
        // 文件上传结束
        onUploadDone: function(serverUrl) {},
        // 获取qchat认证token成功
        onAuthDone: function(args) {},
        // 获取qchat认证token失败
        onAuthFail: function(err) {},
        // 正在重连
        onReconnecting: function(flag) {},
        // 历史消息回调，只有一个字段判断是否还有更多
        onHistory: function(args) {}
    };

    this.Enums = enums;
    this.Enums.ConnectionStatus = qchatCore.ConnectionStatus;
    this.options.maType = settings.maType;
    this.emotions = new Emotions(domain);
    MsgHelper.setOptions(this.emotions);
};

QchatSDK.prototype.setOptions = function(options, callbacks) {
    var self = this;

    // 当前聊天对象唯一标示符
    // 如果启用了机器人，那么默认就是机器人的id
    if(options.enableRobot && options.robotStrid) {
        options.strid = options.robotStrid;
    }

    this.strid = options.strid = options.strid && options.strid.toLowerCase().replace('@', '[at]') || '';

    utils.extend(true, this.options, options);
    utils.extend(true, this.callbacks, callbacks);

    // 聊天类型：1-和qtalk聊天；2-和qchat聊天
    if (this.options.targetType == enums.TargetType.QTALK) {
        this.options.toDomain = enums._Domain.QTALK;
    }

    // 封装一层消息回调函数，预处理消息，封装差异
    var onMsgCallbackOrigin = this.callbacks.onMsgCallback;

    this.callbacks.onMsgCallback = function(msgArr) {
        msgArr = $.isArray(msgArr) ? msgArr : [msgArr];

        if(msgArr.length === 0) {
            return;
        }

        var firstMsg = msgArr[0];
        // 这里预处理ochat的start end消息

        if(false && msgArr.length === 1 && firstMsg.msgType == self.Enums.MsgTypes.OCHAT) {
            var ochatData = firstMsg.$message.children('body').attr('ochat');

            var ochatJson, type;

            if(ochatData) {
                ochatJson = JSON.parse(ochatData);
                type = ochatJson.t;
            }

            if(type == self.Enums.OchatStatus.START) {
                self.callbacks.onNewConnection.call(null, firstMsg, ochatJson);
            } else if(type == self.Enums.OchatStatus.END) {
                converse.cleanOnChatEnd(firstMsg.from);
                self.callbacks.onChatEnd.call(null, firstMsg, ochatJson);
            } else {
                onMsgCallbackOrigin.call(null, msgArr);
            }
        } else {
            // 收到结束消息
            if(firstMsg.isEndMsg) {
                self.callbacks.onChatEnd.call(null, firstMsg);
            } else {
                for(var i = 0; i < msgArr.length; i++) {
                    msgArr[i].message = MsgHelper.decode(msgArr[i].message, msgArr[i].msgType);
                }

                if(firstMsg.isNewConnect) {
                    self.callbacks.onNewConnection.call(null, msgArr);
                } else {
                    onMsgCallbackOrigin.call(null, msgArr);
                }
            }
        }
    };

    UploadModule.setOptions({
        converse: converse,
        domain: domain,
        sendFileId: this.options.sendFileId,
        sendFileClass: this.options.sendFileClass,
        sendImageId: this.options.sendImageId,
        sendImageClass: this.options.sendImageClass,
        onUploadStart: this.callbacks.onUploadStart,
        onUploadProgress: this.callbacks.onUploadProgress,
        onUploadDone: this.callbacks.onUploadDone,
        showMessage: this.options.showMessage
    });

    this.isSet = true;

    return this;
};

QchatSDK.prototype.init = function() {
    if(this.isSet === false) {
        throw new Error('您还未配置qchat');
    }

    if(this.inited) {
        return false;
    }

    // 如果支持websocket且配置了使用webSocket则切换到web socket
    if(this.options.useWebSocket && utils.isSupportWebSocket()) {
        settings.server.bosh_service_url = settings.server.webSocket_boah_service_url;
    }

    utils.extend(this.options, settings.server);

    try {
        converse.initialize(this.options, this.callbacks);
        this.inited = true;
        return true;
    } catch(err) {
        console.log(err); // eslint-disable-line
        return false;
    }
};

QchatSDK.prototype.disconnect = function() {
    converse.disconnect();
};

// 发送一条消息
QchatSDK.prototype.sendMsg = function(msg, msgType, args) {
    // 对消息进行格式预处理
    msg = MsgHelper.encode(msg);
    msgType = msgType || this.Enums.MsgTypes.NORMAL;

    var sendCallback, sendArgs;

    if(typeof args === 'function') {
        sendCallback = args;
    } else {
        if(typeof sendCB === 'function') {
            sendCallback = sendCB;
        } else {
            sendCallback = this.options.showMessage;
        }

        sendArgs = args;
    }

    var result = converse.sendMessage(msg, msgType, sendArgs);
    var to = this.activeStrid;

    result && sendCallback([{
        fullname: converse.settings.get('myName'),
        imageUrl: converse.settings.get('myImage') || settings.defaultHeadImage,
        sender: 'me',
        message: MsgHelper.decode(msg, msgType),
        msgType: msgType,
        to: to,
        originArgs: args
    }]);

    return result;
};

// 发送抖动窗口
QchatSDK.prototype.sendShake = function() {
    var text = '给您发送了窗口抖动',
        msgType = this.Enums.MsgTypes.SHAKE;
    var result = converse.sendMessage(text, msgType);

    result && this.options.showMessage([{
        sender: 'me',
        message: '您发送了一个窗口抖动',
        msgType: msgType,
        fullname: converse.settings.get('myName'),
        imageUrl: converse.settings.get('myImage') || settings.defaultHeadImage
    }]);
};

QchatSDK.prototype.getEmotions = function() {
    return this.emotions.getEmotionsList(this.options);
};

// 主动结束一个聊天，qchat中就是发送一条聊天结束消息
QchatSDK.prototype.endChat = function(strid, sid) {
    var ret;

    if(false && this.options.busiLoginType === 'ochat') {
        var ochatAttr = {
            ochat: {
                t: 59,
                sId: sid
            },
            extendInfo: {
                t: 59,
                sId: sid
            }
        };

        ret = this.sendMsg('OchatEnd', this.Enums.MsgTypes.OCHAT, ochatAttr);
    } else {
        ret = converse.sendEndMessage();
    }

    return ret;
};

// 获取历史消息
QchatSDK.prototype.getHistoryMsg = function(strid, count) {
    var temp;
    // 兼容count, strid的传参方式

    if(typeof strid === 'number') {
        temp = count;
        count = strid;
        strid = temp;
    }

    converse.getHistory(count || 20, strid);
};

QchatSDK.prototype.switchContact = function(strid, virtualId, cctext) {
    this.activeStrid = strid = strid && strid.toLowerCase().replace('@', '[at]') || '';
    converse.sdkSwitchContact(strid, virtualId, cctext);

    return this;
};

QchatSDK.prototype.allMessageRead = function(strid) {
    converse.allMessageRead(strid);
};

// 发送图片 - 先上传图片，然后发送图片服务器端地址
// imageSrc: 图片服务器地址，必传
QchatSDK.prototype.sendImageMsg = function(imageSrc, sendCB) {
    if(!imageSrc || typeof imageSrc !== 'string') {
        return false;
    }

    var self = this;
    var msgType = this.Enums.MsgTypes.NORMAL;
    var sendCallback = sendCB || this.options.showMessage;
    var msgDeffered = MsgHelper.prefixImageMsg(imageSrc);

    msgDeffered.done(function(result) {
        var msg = result.ret ? result.data : null;
        var ret = converse.sendMessage(msg);

        sendCallback.call(self, [{
            fullname: converse.settings.get('myName'),
            imageUrl: converse.settings.get('myImage') || settings.defaultHeadImage,
            sender: 'me',
            message: MsgHelper.decode(msg, msgType),
            msgType: msgType,
            to: this.activeStrid,
            originArgs: null
        }]);

        return ret;
    });
};

// 发送文件 - 先上传文件，然后发送文件服务器端地址 + 文件名
// fileName: 文件名，必传
// fileSrc: 文件服务器端地址，必传
// fileSize: 文件大小，单位字节
QchatSDK.prototype.sendFileMsg = function(fileName, fileSrc, fileSize, sendCB) {
    if(!fileName || !fileSrc || !fileSize) {
        return false;
    }

    var msg = MsgHelper.prefixFileMsg(fileName, fileSize, fileSrc);
    var msgType = this.Enums.MsgTypes.FILE;
    var ret = converse.sendMessage(msg, msgType);
    var sendCallback = sendCB || this.options.showMessage;

    sendCallback.call(this, [{
        fullname: converse.settings.get('myName'),
        imageUrl: converse.settings.get('myImage') || settings.defaultHeadImage,
        sender: 'me',
        message: MsgHelper.decode(msg, msgType),
        msgType: msgType,
        to: this.activeStrid,
        originArgs: null
    }]);
    return ret;
};

QchatSDK.prototype.getUserCard = function(strid) {
    return converse.getVcard(strid);
};

// 解析消息内容，主要解析图片、表情、文件
QchatSDK.prototype.parseMsg = function(msg, msgType) {
    if(!msg) {
        return msg;
    }

    return MsgHelper.decode(msg, msgType || this.Enums.MsgTypes.NORMAL);
};

window.QchatSDK = new QchatSDK();
