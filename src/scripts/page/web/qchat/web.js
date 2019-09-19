if(typeof window.QCHAT == "undefined") {
    window.QCHAT = {};
}
$(document).ready(function() {

    require("tmpl/web/qchat.mustache");
    require("tmpl/web/msg.mustache");
    require('tmpl/web/detail.mustache');
    require('tmpl/web/order.mustache');
    // 留言提示信息类型模板
    require("tmpl/web/leaveMessage/msg_01.mustache");
    require('tmpl/web/leaveMessage/msg_02.mustache');
    require('tmpl/web/leaveMessage/msg_03.mustache');

    var msgTmpl_01 = QTMPL.msg_01.render();
    var msgTmpl_02 = QTMPL.msg_02.render();
    var msgTmpl_03 = QTMPL.msg_03.render();

    require("lib/qevent/index.js");
    require('lib/extension/string.js');
    require('lib/extension/function.js');

    var qchatCore = require("qchat/qchat-core.js");
    var browseHistory = require("./browse-history.js");
    var LeaveMessage = require("./leaveMessage.js");
    var LeaveWechat = require("./leaveWechat.js");
    var audioPlayer = require("utils/audioPlayer.js"); // 播放器
    var leftBar = require('./leftbar/leftbar.js');
    var businessMessage = require('./businessMessage.js'); // 业务消息处理
    var captcha = require('../../common/captcha.js');
    var ConnectionStatus = qchatCore.ConnectionStatus;
    var c2bOrderInfo = require('common/c2bOrderInfo.js'); //获取C2B订单信息
    var utils = require('utils/utils_web.js').utils;
    var msgLogic = require('common/msgLogic.js');
    var Notification = require('common/notification.js');
    var smartRobot = require('common/smartRobot');
    var notify = require('common/notify');

    var symbol = [
        ['&lt;', '<'],
        ['&gt;', '>']
    ];

    // 对应的业务线ID号
    var buContainer = {
        'dujia': 1,
        'flight': 2,
        'hotel': 3,
        'local': 4,
        'menpiao': 5,
        'cheche': 6,
        'jijiu': 7,
        'huichang': 8
    };
    var isVistualUser = false;
    var MORE = '查看更多消息';
    var maType = 6; // 平台类型web端：6
    var NO_MORE = '没有更多消息了';
    var LM_REGEXP = /(微信|QQ|手机号|(\+*86|0)?1[358]{9})/ig; // 关键词过滤规则
    var LEAVE_MESSAGE_01 = '<div class="talk_me clr"><div class="prompt clr">客服当前忙碌，您可以<a id="js_lm" class="js_lm">发送联系方式</a>给商家，商家看到后会第一时间联系您！</div></div>';
    var LEAVE_MESSAGE_02 = '<div class="talk_me clr"><div class="prompt clr">如需客服电话联系您，可以<a id="js_lm" class="js_lm">发送联系方式</a>给客服，客服看到后会第一时间联系您哦！</div></div>';
    var DOWN_URL = window.nav_igator.baseaddess.fileurl + '/';
    var XMPP_URL = window.nav_igator.baseaddess.xmpp;
    //var bosh_service_url = "http://" + XMPP_URL + '/http-bind/';
    var bosh_service_url = '/http-bind/';
    var http_api_server = XMPP_URL + 'api/';
    var loginDialog = require("./loginDialog.js");

    var QCAdminApis = {
        // rightbar的detail展示数据
        detailUrl: '/qcadmin/api/pdt/productDtl.qunar',
        // 最近咨询
        // recentProUrl: '/qcadmin/api/pdt/lastOne.json',
        recentProUrl: '',
        // 暂无提供接口,更新客服开始最近一个会话的时间
        chatReadyConfirm: ''
    };

    // 默认头像
    var defaultHeadImage = '../../../../assets/png/defaultAvatar.png';
    var scrollHeight = 0;
    var limitFileSize = 1024 * 1024 * 50; // 50M;

    var leaveMessageForbiddenList = [
        'hotel'
    ];

    var ChatPage = function() {
        this.html = QTMPL.qchat.render();
        this.converse = qchatCore.converse || {};

        this.utils = require("utils/utils_web.js").utils;
        
        // 检查是否支持web socket协议；如果支持切换到web socket
        var canUseWebSocket =  utils.isSupportWebSocket();

        if(canUseWebSocket) {
            bosh_service_url = (location.protocol === 'https:' ? 'wss:' : 'ws:') + XMPP_URL + '/websocket';
        }

        this.setting = {
            bosh_service_url: bosh_service_url,
            forward_messages: false,
            domain: window.nav_igator.baseaddess.domain,
            toDomain: window.nav_igator.baseaddess.domain,
            message_carbons: false,
            http_api_server: http_api_server
        };
        this.emoticonIndex = 0;
        this.strid = ''; //当前聊天的客服，留言使用
        this.lm_info = {};
        this.KEY = {
            ENTER: 13,
            FORWARD_SLASH: 47
        };

        this.cacheProductDetail = {};

        /*
         * 产品信息接口地址：
         * 需使用者自己提供接口
         */
        this.hostConfig = {
            order: ""
        };
        //留言相关接口和变量
        this.lmconfig = {
            head: '',
            getMobile: '/user/message/getMobileFromRequest.json', //获取用户信息
            sendMessage: '/user/message/saveMessage.qunar',
            getCode: '/user/message/sendMobileCode.json',
            leaveMessage: false, // 留言功能
            lm_timing: '', // 留言计时器
            timing: 0 // 留言计时

        };

        this.stridForLocal = {
            9440504: 'believe3301',
            9740725: 'cirf1284',
            9740740: 'llljqjf9293',
            9740751: 'zigjrgt7549',
            9691567: 'bydf1620',
            9740702: 'sgvkcho3277',
            9740704: 'cadjteu0538',
            9740729: 'sujing996799',
            9740730: 'yahk9935',
            9740732: 'cljj6482',
            9740724: 'iwoqfwi7155',
            9740741: 'pvakxlf9346',
            9740742: 'gndgyyk2527',
            9740750: 'iuvekom3870',
            9740752: 'dzuk6870',
            9740754: 'ehae8950'
        };
    };
    ChatPage.prototype = {
        _getQueryParams: function() {
            var uin = this.getQueryString('uin');
            var sss = this.getQueryString('strid');
            // 指定的客服（对方）id
            var strid = (sss && sss.toLowerCase()) || (uin && this.stridForLocal[uin]) || '';

            // 应刘帆要求，处理和XMPP关键字冲突的符号 -- baotongw
            this.strid = strid.replace('@', '[at]');
            this.shopId = this.getQueryString('shopId') || '';
            this.seatId = this.getQueryString('seatId') || '';
            this.pid = this.getQueryString('id') || '';
            this.bu_name = this.getQueryString('line');
            // 1 - 售后； 2 - 售前
            this.service_type = this.getQueryString('service_type') || '0';
            this.service_url = this.getQueryString('url');
            // 是否匿名-未登录就是匿名
            // this.anonymousFlag = this.getQueryString('anony') === '1';//旧代码-匿名登录
            // this.anonymousFlag = false;
            this.source = this.getQueryString('source');

            // 获取第三方接入的用户信息(用于直接聊天,不需要弹出登录框登录)
            // virtualAcc={"lname":"baotongw","lcredence":"sdfafere2r#112321#!#!@#$sdfsdfsdf"}
            this.virtualAcc = this.getQueryString('virtualAcc') || '';
            // 聊天类型：1-和qtalk聊天；2-和qchat聊天
            this.toDomain = this.getQueryString('toDomain');
            // 由意向单平台传入的的意向单号
            this.wishId = this.getQueryString('wishid');
            this.wishIdMode = !!this.wishId;
        },

        config: function() {
            this._getQueryParams();
            this.isFirstRenderRightBar = true;
            var bu_name = this.bu_name;
            var ipAddress = QNR && QNR.chatData && QNR.chatData.ip || '';
            var isAnonymous = !loginDialog.isLogin() && true;
            this.enableLeaveMesage = leaveMessageForbiddenList.indexOf(this.source) === -1;

            // 上次留言时间
            var qchat_lm = $.cookie('qchat_lm');
            var qchat_lm_time;
            if(qchat_lm && qchat_lm.split('_').length > 1) {
                qchat_lm_time = parseInt(qchat_lm.split('_')[1]);
            }

            // 来自会场的虚拟账号
            if(this.virtualAcc) {
                this.virtualAcc = JSON.parse(this.virtualAcc);
            }

            // 会场
            if(bu_name == '8' || bu_name == 'huichang') {
                isVistualUser = true;
            }

            // 聊天类型：1-和qtalk聊天；2-和qchat聊天
            if(this.toDomain == '1') {
                this.setting.toDomain = 'ejabhost1';                
                // 不属于售前售后
                this.service_type = null;
            }

            if(/^null$/i.test(this.service_url)) {
                this.service_url = '';
            }

            var options = {
                virtualId: this.shopId,
                strid: this.strid,
                bu_name: bu_name,
                seatId: this.seatId,
                service_type: this.service_type,
                service_url: this.service_url,
                pid: this.pid,
                chatType: 'web',
                maType: maType, // 平台类型web端：6
                ipAddress: ipAddress,
                domainType: this.toDomain,
                virtualAcc: this.virtualAcc,
                isUCenter: true,
                isAnonymous: isAnonymous
            };

            options.isUCenter = isAnonymous ? false : true;

            this.business_name = bu_name; // 业务名称
            this.isDujia = bu_name === 'dujia';

            if(bu_name === 'dujia' && (!qchat_lm || qchat_lm_time + 24 * 60 * 60 < new Date().getTime())) {
                this.lmconfig.leaveMessage = true;
            }

            $.extend(this.setting, options || {});

            var isRobot = this.getQueryString('isrobot'),
                pid = this.getQueryString('pid'),
                bsid = this.getQueryString('bsid'),
                bu = this.getQueryString('line'),
                backupinfo = [{
                    type: 50010,
                    data: {
                        bu: bu,
                        pid: pid,
                        bsid: bsid
                    }
                }];
                if (bu_name === "jijiu") {
                    backupinfo = [{
                        type: 50010,
                        data: {
                            bu: bu_name,
                            pid: this.getQueryString('id'),
                            bsid: '1'
                      }
                    }]
                }
            isRobot && (this.setting.backupinfo = backupinfo)
            // 已登陆或者开启了匿名登陆都直接初始化
            // loginDialog.isLogin()|| isAnonymous
            if(true) {
                this.initConverse();
            } else {
                loginDialog.run(this.initConverse.bind(this));
            }

            smartRobot.questionSuggest.init({
                startRobot: isRobot,
                bsid: bsid || '',   // 店铺id
                bu: bu || 'dujia',    // 业务线id
                pid: pid || '' // 当前咨询产品id
            });
            smartRobot.robotChat.init(isRobot, {
                chatObj: this,
                switchContact: function(params) {
                    leftBar.switchContact({
                        strid: params.strid,
                        virtualId: params.shopId,
                        webName: params.webName,
                        shopName: params.shopName,
                        host: window.nav_igator.baseaddess.domain
                    });
                    
                    leftBar.setCache(params.shopId, params.strid, params.webName);
                }
            });
            
            return this;
        },
        //初始化
        initConverse: function() {
            var self = this;

            if(this.converse && this.converse.initialize) {
                this.converse.initialize(this.setting, {
                    runContext: this,
                    onAuthDone: this.onAuthDone.bind(this),
                    onAuthFail: this.onAuthFail,
                    onStatusChangeCallback: this.onStatusChange,
                    onHistory: this.onHistory.bind(this),
                    onCard: this.onCard,
                    onPlayNotificationCallback: this.playNotification,
                    onHistoryPatch: this.onHistoryPatch,
                    onMsgCallback: function (msgs) {
                        self.showMessage.call(self, msgs, false);
                    },
                    onReadmarkCallback: function (msg) {
                        if (msg.$message.attr('read_type') === '4') {
                            var ids = [];
                            if ($.isArray(msg.id)) {
                                $.each(msg.id, function (index, item) {
                                    ids.push('#' + item.id.replace('consult-', '') + ' .state');
                                });
                            } else {
                                ids.push('#' + msg.id + ' .state');
                            }

                            $(ids.join(',')).addClass('read').html('已读');
                        }
                    },
                    // onLeftBarReLoadContact: this.onLeftBarReLoadContact,
                    onChatReady: this.onChatReady.bind(this),
                    onSendMsgLock: this.onSendMsgLock.bind(this),
                    onMsgLockCheck: this.onMsgLockCheck.bind(this)
                });
            }
        },

        init: function() {
            $('body').append(this.html);
            this.config();
            
            this.browseHistory = new browseHistory();
            
            // 表示是否锁定不让发消息
            this.msgLock = false;
            
            this.$moreMsg = $('#more_msg');
            this.$overview = $('.overview');
            this.$viewport = $('.viewport');
            this.$loading = $('#loading');
            this.$msgInput = $('#text');
            this.$submitBtn = $('#submit');
            
            this.initEvent();
            this.leftBarDeffered = new $.Deferred();
            
            if(!this.strid) {
                this.$moreMsg.hide();
                this.$loading.hide();
            }
            
            this.hideLeftBar();
            captcha.init(this.converse.checkCaptchaCode);
        },
        
        hideLeftBar: function() {
            //如果是酒店业务过来的隐藏左边列表
            var s = this.getQueryString('source') || '';
            if(s == "hotel") {
                leftBar.hide();
            }
        },
        
        setChatWindowTitle: function(shopName, consultName) {
            var $supplierName = $('#supplierName'),
                $chatName = $('#chatName');
            if(shopName) {
                typeof shopName === 'string' && $supplierName.text(shopName);
                $chatName.text('(' + consultName + ')');
            } else {
                $supplierName.text('客服')
                $chatName.text(consultName);
            }
        },
        
        initLeftBar: function(args) {
            var self = this;
            leftBar.init(args);
            var $supplierName = $('#supplierName'),
                $chatName = $('#chatName');
            // 更新店铺名和用户名
            leftBar.registe(leftBar.callbackType.updateUserInfo, self.setChatWindowTitle);
            
            // 注册切换联系人的回调
            leftBar.registe(leftBar.callbackType.switchContact, function(newContact, isDefault) {
                self.$moreMsg.text(MORE);
                self.clearMessages(true);
                
                // 切换聊天对象
                self.converse.switchContact(newContact);
                // 从头开始fetch
                self.getHistory(20, newContact.virtualId || newContact.strid, true);
                
                // url没有默认指定聊天对象的时候才去指定左侧边栏的第一个
                if(!isDefault) {
                    // 切换聊天对象
                    self.converse.switchContact(newContact);
                    $.extend(self.setting, newContact);
                }
                
                self.setChatWindowTitle(newContact.shopName, newContact.webName);
                
                //获取最近咨询的产品
                if(!isDefault) {
                    var virtualId = newContact.virtualId,
                        strid = newContact.strid;
                    // 优先渲染缓存
                    if(self.cacheProductDetail[virtualId || strid]) {
                        $('.qt-product-message').html(QTMPL.detail.render({
                            data: self.cacheProductDetail[virtualId || strid]
                        }));
                    } else if((virtualId && virtualId === strid) || (!virtualId && self.defaultStrId && self.defaultStrId === strid) && ['huichang', 'hotel', '8'].indexOf(self.business_name) === -1) {
                        //本次咨询的产品
                        self.renderRightBar(args.myId);
                    } else {                   
                        self.getRecentProductId(virtualId || newContact.strid,args.myId);
                    }
                }
                
                // 表示左边栏ready
                if(isDefault) {
                    self.leftBarDeffered.resolve();
                    self.defaultStrId = newContact.strid;
                }
            });
        },
        initEvent: function() {
            var self = this;
            //联系方式留言
            var edt = document.getElementById("text");
            
            $("#close").click(function(e) {
                e.preventDefault();
                if(confirm("您确定要关闭本页吗？")) {
                    self.close();
                    window.close();
                }
            });
            
            this.$moreMsg.click(function(e) {
                e.preventDefault();
                this.getHistory(20, this.shopId || this.strid);
            }.bind(this));
            
            this.$msgInput.keypress(function(e) {
                this.keyPressed(e);
            }.bind(this));
            
            this.$msgInput.mouseup(function(e) {
                utils.saveRange(edt);
            });
            
            this.$msgInput.keyup(function(e) {
                utils.saveRange(edt);
                smartRobot.questionSuggest.startSuggest(self.$msgInput.text());
            });
            
            this.$submitBtn.click(function(e) {
                e.preventDefault();
                this.getInputAndSend();
                
            }.bind(this));
            
            $(document).on('paste', '#text', function() {
                utils.pasteHandler(edt)
            });
            
            $(document).on('click', '#js_lm', function(e) {
                e.preventDefault();
                this.getUserInfo(this.showLeaveMessage);
            }.bind(this));
            
            //留言微信号
            $(document).on('click', '#js_wechat', function(e) {
                e.preventDefault();
                this.getUserInfo(this.showLeaveWechat);
            }.bind(this));
            
            $("#smiley").click(function(e) {               
                this.toggleEmoticonMenu();
            }.bind(this));
            
            $("#shake").click(function(e) {               
                var text = "给您发送了窗口抖动";
                var msgType = "10";
                var id = this.converse.sendMessage(text, msgType);
                if(id) {
                    this.showMessage({
                        fullname: this.converse.settings.get("myName"),
                        sender: 'me',
                        message: text,
                        imageUrl: this.converse.settings.get("myImage") || defaultHeadImage,
                        msgType: msgType,
                        id: id
                    }, true);
                }
            }.bind(this));
            
            this.$viewport.scroll(function() {
                if(this.$viewport[0].scrollHeight <= 0) {
                    this.getHistory(20, this.shopId || this.strid);
                }
            }.bind(this));
            
            $(document).on("click", ".toggle-smiley dl dd", function(e) {
                this.switchEmoticon(e);
            }.bind(this));
            
            $(document).on("click", ".toggle-smiley ul li", function(e) {
                this.insertEmoticon(e);
            }.bind(this));
            
            var iframe = false;
            var browser = navigator.appName;
            var b_version = navigator.appVersion;
            var version = b_version.split(";");
            if(browser == "Microsoft Internet Explorer" && version.length > 1) {
                var trim_Version = parseInt(version[1].replace(/[ ]/g, "").replace(/MSIE/g, ""));
                if(trim_Version < 10) {
                    iframe = true;
                }
            }
            //发送图片(上传图片)
            $(document).on("click", "#imageupload", function(e) {
                var u = this.converse.settings.get("myName");
                var k = this.converse.settings.get("key");
                var url = "/file/v2/upload/img?size=48&u=" + u + "&k=" + k + "&key=test";
                
                $('#imageupload').fileupload({
                    dropZone: undefined,
                    url: url,
                    dataType: 'json',
                    autoUpload: false,
                    forceIframeTransport: iframe,
                    limitMultiFileUploadSize: 1024 * 1024 * 50, //50M
                    add: function(e, data) {
                        data.process().done(function() {
                            $.each(data.files, function(index, file) {
                                
                                var key = $.md5(utils.createUUID()); //$.md5(file.name);
                                var sizeMB = utils.bytesToMB(file.size);
                                var paramLink = "name=" + file.name + "&size=" + sizeMB + "&u=" + u + "&k=" + k + "&key=" + key + "&p=qim_web";
                                var url = "/file/v2/upload/img?" + paramLink;
                                
                                if(file.size > limitFileSize) {
                                    alert("图片大小不能超过50M");
                                    return;
                                }
                                
                                //设置新的提交地址
                                data.setSubmitURL(url);
                                
                                //校验上传的文件是否存在
                                //如果文件存在了就不上传了，直接显示为和上传成功的效果
                                var checkFileUrl = "/file/v2/inspection/img?" + paramLink;
                                
                                self.checkUpLoadFileExist(checkFileUrl, function(resultData) {
                                    
                                    var msgTml = QTMPL.msg.render({
                                        sender: true,
                                        time: new Date().format1('MM-dd hh:mm:ss'),
                                        username: self.converse.settings.get("myName"),
                                        imageUrl: self.converse.settings.get("myImage") || defaultHeadImage,
                                        message: file.name,
                                        id: 'image'
                                    });
                                    
                                    data.context = $(msgTml).appendTo(self.$overview);
                                    $(data.context).find('p').first().append('<div class="bar" style="width:100%;min-width:100px"><div class="green" style="width:0%;"></div></div>');
                                    
                                    //文件不存在
                                    if(resultData.ret) {
                                        //提交上传文件
                                        data.submit();
                                    } else {
                                        //文件已存在了直接显示上传成功效果
                                        var result = resultData.data; //存在的文件URL地址
                                        if(iframe) {
                                            result = $('pre', result).text();
                                        }
                                        
                                        var msg = '[obj type="image" value="' + result + '"]';
                                        var id = self.converse.sendMessage(msg);
                                        $(data.context).attr('id', id);
                                        $(data.context).find('p').first().html('<img src="' + result + '"/>');
                                        $(data.context).find('.green').first().css('width', "100%");
                                    }
                                    
                                    self.scrollBottom();
                                });
                            });
                        });
                    },
                    done: function(e, data) {
                        var result = data.result.data;
                        if(iframe) {
                            result = $('pre', result).text();
                        }
                        
                        var msg = '[obj type="image" value="' + result + '"]';
                        var id = self.converse.sendMessage(msg);
                        $(data.context).attr('id', id);
                        $(data.context).find('p').first().html('<img src="' + result + '"/>');
                        self.scrollBottom();
                    },
                    progress: function(e, data) {
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        $(data.context).find('.green').first().css('width', progress + "%");
                    }
                    
                });
            }.bind(this));
            
            //发送文件(上传文件)
            $(document).on("click", "#fileupload", function(e) {
                var u = this.converse.settings.get("myName");
                var k = this.converse.settings.get("key");
                var url = "/file/v2/upload/file?size=46&u=" + u + "&k=" + k + "&key=1234";

                var fileupload = $('#fileupload').fileupload({
                    url: url,
                    dropZone: undefined,
                    forceIframeTransport: iframe,
                    dataType: 'json',
                    add: function(e, data) {
                        
                        data.process().done(function() {
                            $.each(data.files, function(index, file) {
                                
                                var key = $.md5(utils.createUUID()); //$.md5(file.name);
                                var sizeMB = utils.bytesToMB(file.size);
                                var paramLink = "name=" + file.name + "&size=" + sizeMB + "&u=" + u + "&k=" + k + "&key=" + key + "&p=qim_web";
                                var url = "/file/v2/upload/file?" + paramLink;
                                
                                if(file.size > limitFileSize) {
                                    alert("文件大小不能超过50M");
                                    return;
                                }
                                
                                //设置新的提交地址
                                data.setSubmitURL(url);
                                
                                //校验上传的文件是否存在
                                //如果文件存在了就不上传了，直接显示为和上传成功的效果
                                var checkFileUrl = "/file/v2/inspection/file?" + paramLink;
                                
                                self.checkUpLoadFileExist(checkFileUrl, function(resultData) {
                                    
                                    var msgTml = QTMPL.msg.render({
                                        sender: true,
                                        time: new Date().format1('MM-dd hh:mm:ss'),
                                        username: self.converse.settings.get("myName"),
                                        message: file.name,
                                        imageUrl: self.converse.settings.get("myImage") || defaultHeadImage,
                                        id: 'file'
                                    });
                                    
                                    data.context = $(msgTml).appendTo(self.$overview);
                                    
                                    $(data.context).find('p').first().append('' +
                                        '<div class="bar" style="width:100%;min-width:100px">' +
                                        '<div class="green" style="width:0%;"></div>' +
                                        '</div>');
                                    
                                    //文件不存在
                                    if(resultData.ret) {
                                        //提交上传文件
                                        data.submit();
                                    } else {
                                        //文件已存在了直接显示上传成功效果
                                        var result = resultData.data; //存在的文件URL地址
                                        if(iframe) {
                                            result = $('pre', result).text();
                                        }
                                        var msg = {
                                            "FILEID": new Date().getTime(),
                                            "FILEMD5": "123",
                                            "FileName": file.name,
                                            "FileSize": utils.bytesToSize(file.size),
                                            "HttpUrl": result
                                        };
                                        var id = self.converse.sendMessage(JSON.stringify(msg), '5');
                                        $(data.context).attr('id', id);
                                        $(data.context).find('.green').first().css('width', "100%");
                                    }
                                    
                                    self.scrollBottom();
                                });
                                
                                $(document).on("click", "#cancelUpload", function(e) {
                                    data.abort();
                                });
                                
                            });
                        });
                    },
                    done: function(e, data) {
                        var result = data.result.data;
                        if(iframe) {
                            result = $('pre', result).text();
                        }
                        if(data && data.files && data.files.length > 0) {
                            var msg = {
                                "FILEID": new Date().getTime(),
                                "FILEMD5": "123",
                                "FileName": data.files[0].name,
                                "FileSize": utils.bytesToSize(data.files[0].size),
                                "HttpUrl": result
                            };
                            var id = self.converse.sendMessage(JSON.stringify(msg), '5');
                            $(data.context).attr('id', id);
                        }
                    },
                    progress: function(e, data) {
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        $(data.context).find('.green').first().css('width', progress + "%");
                    }
                });
            }.bind(this));
            
            $('.slider_tab').on('click', '.slider_tab_icon', function(e) {
                var e = e || window.event,
                    tab = $(this).attr('data-tab'),
                    $page = $('.pt-' + tab);
                
                if($page.length > 0) {
                    $(this).addClass('choose-icon').siblings().removeClass('choose-icon');
                    $page.show().siblings().hide();
                }
            });
            
            QNR.qevent.on('sendProUrl', function(text) {
                if(text) {
                    self.getInputAndSend(text);
                }
            });

            if(typeof window.onbeforeunload !== 'undefined') {
                window.onbeforeunload = function() {
                    return qchatCore.converse.disconnect();
                }
            } else if(typeof window.onunload !== 'undefined') {
                window.onunload = function() {
                    
                    return qchatCore.converse.disconnect();
                }
            }
        },
        
        close: function() {
            this.converse.account.logout();
        },
        
        /**
         * 根据客户ID获取最近一条在该客服下咨询过的产品ID
         */
        getRecentProductId: function(strid,userQName) {
            var self = this;
            if(!strid) {
                return;
            }
            $.ajax({
                url: QCAdminApis.recentProUrl,
                type: 'GET',
                dataType: 'jsonp',
                data: {
                    seatQName: strid,
                    userQName:userQName
                },
                success: function(result) {
                    var data = result && result.data;
                    if(data && result.ret && data.tts_enid) {
                        //获取到当前咨询的产品id之后，获取产品详细信息
                        self.renderDetail(data.tts_enid, data.businessId,userQName);
                    } else {
                        self.noresult();
                    }
                },
                error: function() {
                    self.noresult();
                }
            });
        },
        
        keyPressed: function(ev) {
            /* Event handler for when a key is pressed in a chat box textarea.
             */
            if(ev.keyCode == this.KEY.ENTER) {
                ev.preventDefault();
                this.getInputAndSend();
            }
        },
        scrollBottom: function() {
            var $view = this.$viewport;
            if($view.is(':visible')) {
                $view.scrollTop($view[0].scrollHeight);
            }
        },
        // qchat token 验证成功
        onAuthDone: function(param) {
            this.userQName = param.username;
        },
        // qchat token 验证失败
        onAuthFail: function(msg) {
            // 匿名登陆失败之后，切到普通登陆
            if(qChatInstance.setting.isAnonymous) {
                qChatInstance.setting.isAnonymous = false;
                qChatInstance.setting.isUCenter = true;
            }
            //loginDialog.run(qChatInstance.initConverse.bind(qChatInstance));
        },
        onSendMsgLock: function() {
            captcha.open();
            this.msgLock = true;
            this.$msgInput.attr('contenteditable', false);
            this.$submitBtn.toggleClass('btn_enter').toggleClass('btn_close');
        },
        onMsgLockCheck: function(status) {
            // 验证成功，放开了消息发送
            // 这里UI部分放开
            switch(status) {
            case true:
                captcha.close();
                this.msgLock = false;
                this.$msgInput.attr('contenteditable', true);
                this.$submitBtn.toggleClass('btn_enter').toggleClass('btn_close');
                break;
            case false:
                captcha.showError();
                break;
            case -1:
                alert('网络错误，校验验证码失败');
                break;
            }
            
            captcha.refresh();
        },
        onStatusChange: function(status) {
            var txt = "";
            if(status == ConnectionStatus.CONNECTED) {
                txt = "已连接";
            } else if(status == ConnectionStatus.DISCONNECTED) {
                txt = "连接断开";
            } else if(status == ConnectionStatus.CONNECTING) {
                txt = "连接中";
            }
            $("#status").text(txt);
        },
        onChatReady: function(myId, key) {
            var self = this;

            //加到这里的原因是初始化需要调用他们的方法
            var source = this.getQueryString('source') || '';
            if(source == "hotel") {
                //下面是酒店提供的接口方法 主要用于问题
                if(window.hotel && window.hotel.sendQuestion) {
                    window.hotel.sendQuestion();
                }
            } else {
                // 渲染右侧咨询产品信息
                self.renderRightBar(myId);
            }
            
            this.initLeftBar({
                defaultStrid: this.strid,
                setting: this.setting,
                myId: myId,
                key: key,
                //初始化客服列表
                getStridContainer: function(stridContainer) {
                    self.converse.setStridContainer(stridContainer);
                }
            });
            
            // 供应商端发给运营的消息
            var toDomain = this.getQueryString("toDomain");
            var defaultMsg = this.getQueryString("defaultMsg");
            var msg = '店铺 [' + defaultMsg + '] 发来一条消息';
            
            if(toDomain == '1' && defaultMsg) {
                this.leftBarDeffered.done(function() {
                    self.getInputAndSend(msg, true);
                });
            }
            
            var dmsg = this.getQueryString('dmsg');
            // 如果没有指定发给谁则不发送
            if(dmsg && this.strid) {
                this.leftBarDeffered.done(function() {
                    self.getInputAndSend(decodeURIComponent(dmsg));
                });
            }
            
            this.getAddC2bOrderInfo(this.strid, myId);
            // 会话建立成功后，给后端发送一个确认请求
            this.sendChatConfirm();
        },
        getHistory: function(pageSize, strid, ifFirst) {
            scrollHeight = this.$viewport[0].scrollHeight;
            
            if(this.$moreMsg.text() != NO_MORE) {
                this.converse.getHistory(pageSize || 20, strid, ifFirst);
                this.$loading.show();
                this.$moreMsg.hide();
            }
        },
        //获取用户信息
        getUserInfo: function(callback) {
            var self = this;
            var ts = new Date().getTime();
            var qunarName = document.cookie.match(/(^|\s)_q=([^;]*)(;|$)/i);
            var token = $.md5((qunarName && qunarName[2] ? qunarName[2].split('.')[1].replace('"', '') : '') + ts.toString());
            $.ajax({
                url: self.lmconfig.head + self.lmconfig.getMobile,
                type: 'GET',
                jsonp: 'callback',
                data: {
                    token: token,
                    ts: ts
                },
                dataType: 'jsonp'
            })
                .then(function(result) {
                    callback.call(self, result.data);
                })
        },
        //初始化留言框
        showLeaveMessage: function(data) {
            var config;
            if(!data) {
                data = {};
            }
            data.imgUrl = this.converse.settings.get("myImage") || defaultHeadImage;
            
            config = $.extend({
                name: '',
                mobile: ''
            }, this.lm_info, this.lmconfig);

            LeaveMessage.init(data, config);
        },
        
        //微信号留言框
        showLeaveWechat: function(data) {
            var config;
            if(!data) {
                data = {};
            }
            data.imgUrl = this.converse.settings.get("myImage") || defaultHeadImage;
            
            config = $.extend({
                name: data.name,
                mobile: data.mobile
            }, this.lm_info, this.lmconfig);
            LeaveWechat.init(data, config);
        },
        
        onCard: function(data, isMe, shopName) {
            //因为头像是ajax获取，如果是历史消息的话有可能不存在
            var headImageURL = defaultHeadImage; //默认头图
            //debugger
            // console.log(data)
            if(data && data.imageurl) {
                headImageURL = data.imageurl;
            }
            
            if(isMe) {
                $(".ask_sub").attr("src", headImageURL);
            } else {
                var supplierName = (data.suppliername ? data.suppliername : '客服');
                var chatName = (data.webname ? data.webname : data.username);
                
                //用户是店铺类型
                if(data.type && data.type == "4" || shopName) {
                    supplierName = shopName || data.nickname;
                    chatName = " (" + (data.webname || data.username) + ")";
                }
                if(supplierName) {
                    $("#supplierName").text(supplierName + " ");
                }
                
                $(".answer-sub").attr("src", headImageURL);
                $("#chatName").text(chatName);
            }
        },
        
        onHistory: function(msg) {
            var self = this;
            this.$loading.hide();
            this.$moreMsg.show();
            
            setTimeout(function() {
                $(".viewport").scrollTop($(".viewport")[0].scrollHeight - scrollHeight);
                if(!msg.hasMore) {
                    self.$moreMsg.text(NO_MORE).css("text-decoration", "none");
                }
            }, 100);
            
        },
        
        onHistoryPatch: function(msgs) {
            leftBar.showRecentMsg(msgs);
        },
        
        /* 重新加载联系人列表 */
        // onLeftBarReLoadContact: function() {
        //     leftBar.leftBarReLoadContact();
        // },
        // 改为兼容单条消息和多条消息的格式
        // onHistory我改成了多条，这样只执行一次append或者prepend
        showMessage: function(msg_dict, doScroll, isSelfMsg) {
            var self = this;
            var list = msg_dict,
                appendList = [],
                prependList = [];

            if(Object.prototype.toString.call(msg_dict) === '[object Object]') {
                list = [msg_dict];
            }

            var $content = this.$overview,
                $viewport = this.$viewport;
            
            for(var i = 0, msg_dict, len = list.length; i < len; i++) {
                msg_dict = list[i];

                var msg_type = msg_dict.msgType,
                    text = msg_dict.message,
                    fullname = msg_dict.fullname,
                    webName = leftBar.getCacheWebname(fullname) || msg_dict.fullname || "",
                    imageUrl = msg_dict.imageUrl || defaultHeadImage,
                    extra_classes = msg_dict.delayed && 'delayed' || '',
                    username,
                    extendInfo = msg_dict.extendInfo || '',
                    isSysMsg = false,
                    itemMsg = false,
                    isRead = msg_dict.isRead;

                // 消息ID
                var id = msg_dict.id;
                if (msg_dict.history) {
                    id = msg_dict.$message.find('body').attr('id');
                }

                var m = msg_dict.stamp ? moment.utc(msg_dict.stamp) : moment.utc();

                m.local();
                msg_time = m.format("MM-DD HH:mm:ss");

                //extendInfo = '{"TransReson": "1234567890","realtoId": "zhu886","toId": "shop_323"}';
                //msg_type = "1001";

                if (msg_type && msg_type == "10" && msg_dict.sender === 'me') {
                    text = "您发送了一个窗口抖动";
                } else if (msg_type) {
                    //没有这个消息就不需要显示了，因为消息和qtalk客服端一样，所以需要屏蔽掉
                    //不然会显示：当前版本不支持此协议，请升级客户端版本查看

                    // 1100 QchatEnd消息类型
                    if (msg_type == "11" || msg_type === '1003' || msg_type == "1100" || (msg_type == "4000" || msg_type == "4001") && (!extendInfo && text == "当前版本不支持此协议，请升级客户端版本查看")) {
                        //break;
                        continue;
                    }

                    //转接的消息类型
                    if (msg_type == "1001") {
                        extendInfo = text && text.replace(/\s/g, ''); //json字符串
                        isSysMsg = true;
                    }
                    
                    if (msg_type == "4003") { //机转人的消息类型
                        isSysMsg = true;
                    }
                }
                
                var isMe = msg_dict.sender == 'me';
                
                //跟据消息类型处理相应业务类的数据:在这里处理
                var extendInfoObj = businessMessage.getMsgHtml(extendInfo, msg_type, isMe);
                
                var extendInfoHtml = "";
                if(extendInfoObj) {
                    extendInfoHtml = extendInfoObj.info;
                    if(msg_type == "4002") {
                        itemMsg = extendInfoHtml;
                        extendInfoHtml = "";
                    }
                    
                    // 转接后，设置聊天框客服名称
                    if(!msg_dict.history && msg_type === '1001') {
                        self.setChatWindowTitle(true, extendInfoObj.consultName);
                        leftBar.setCache(extendInfoObj.shopId, extendInfoObj.consultId, extendInfoObj.consultName);
                    }
                    text = extendInfoObj.title;
                }

                if(msg_dict.realFrom) {
                    leftBar.setCache(msg_dict.from, msg_dict.realFrom, null);
                }
                
                var messageContent = "";
                if(isMe) {
                    messageContent = extendInfoHtml;
                }
                
                var msgHtml = "";
                
                //如果是C2B订单消息信息模板样式不一样
                if(msg_type == "888") {
                    text = "";
                    messageContent = "";
                    //获取C2B显示模板
                    msgHtml = c2bOrderInfo.getMsgHtml(extendInfo, msg_type, false);
                } else {
                    msgHtml = QTMPL.msg.render({
                        'sender': isMe,
                        'time': msg_time,
                        'username': username,
                        'imageUrl': imageUrl,
                        'message': '',
                        'extra_classes': extra_classes,
                        'extendInfo': extendInfoHtml,
                        'isSysMsg': isSysMsg,
                        'id': id,
                        'isRead': isRead
                    });
                }
                
                var robotMsg = smartRobot.robotChat.handleRobotMessage(msg_type, extendInfo, {
                    time: msg_time,
                    username: username,
                    imageUrl: imageUrl
                });
                
                msgHtml = robotMsg && robotMsg.html || msgHtml;
                text = robotMsg && robotMsg.text || text;
                
                var strid = self.converse.settings.get('strid'),
                    shopId = self.converse.settings.get('virtualId');

                if (msg_type === 'notify') {
                    if (text && +msg_dict.category === 99 && (text.isConsult ? shopId : strid) === (text.from || '').split('@')[0]) {
                        msgHtml = notify.render(text);
                    } else {
                        continue;
                    }
                }
                
                var $msg = $(utils.escape2Html(msgHtml));
                var $msgContent = $msg.find('p').first().text(text);
                if(isMe || itemMsg) {
                    $msgContent = $msg.find('p').first().html(text || messageContent);
                    
                    //4002 消息类型
                    if(itemMsg) {
                        $msg.find('p').after(utils.escape2Html(itemMsg));
                    }
                }
                
                if(msg_type && msg_type == "5") {
                    $msgContent.addFileLinks(DOWN_URL);
                } else {
                    $msgContent.typeSet(DOWN_URL);
                }
                //显示当前聊天信息
                if(!msg_dict.history) {
                    //1.判断是不是当前客户过来的信息
                    //2.判断自己发的信息
                    // 业务线名称
                    // 酒店的需求没有左侧联系人列表，而有机器人发来的消息，只能显示到当前用户聊天框内
                    
                    if((this.source === 'hotel' && msg_dict.from && msg_dict.from === this.strid) ||
                        (msg_dict.from && msg_dict.from === leftBar.activeId) || isSelfMsg ||
                        msg_type === 'notify') {
                        doScroll = true;
                        
                        if(!isMe) {
                            // 交给系统通知，如果当前focus，则不弹、否则弹
                            Notification.showNotice(msg_dict.from, msg_dict.message, msg_dict.imageUrl);
                        }

                        // $content.append($msg);
                        appendList.push($msg.prop('outerHTML'));

                        if(LM_REGEXP.test(text) && this.isDujia) {
                            appendList.push(LEAVE_MESSAGE_02);
                        }
                        
                        if(qChatInstance.lmconfig.lm_timing) {
                            clearTimeout(qChatInstance.lmconfig.lm_timing);
                            qChatInstance.lmconfig.lm_timing = '';
                            qChatInstance.lmconfig.timing = 0;
                        }
                    }
                } else { //显示历史聊天信息
                    prependList.push($msg.prop('outerHTML'));
                    // $content.prepend($msg);
                }
                //历史记录
                if(msg_dict.history) {
                
                } else {
                    //更新当前聊天消息
                    leftBar.updateActiveMsg(text, msg_dict.sender, msg_dict.from);
                }
                
            } //end for
            
            appendList.length && $content.length && $content.append(appendList.join(''));
            prependList.length && $content.length && $content.prepend(prependList.join(''));
            
            if(doScroll && $viewport.is(':visible')) {
                $viewport.scrollTop($viewport[0].scrollHeight);
            }
        },
        
        //来信息时播放声音
        playNotification: function() {
            var playId = "js-player";
            var file = "../../../../assets/voice/msg.mp3";
            
            //调用播放器
            audioPlayer.play(playId, file);
        },
        
        // skipAutoRender: 这里处理的是默认发送的消息，发送完了不在当前qchat展示，类似sendServiceMsg
        getInputAndSend: function(text, isHiddenMsg) {
            //debugger
            if(this.msgLock) {
                return
            }
            
            var self = this;
            var message = text || this.$msgInput.html();
            
            if(message !== '') {
                //更新当前客服聊天的消息数量
                // leftBar.updateActiveUnreadNum();

                // 如果碰到意向单，需要判断一下输入的内容；如果是一个产品detail，需要在url上补上意向单
                if(this.wishIdMode) {
                    message = msgLogic.checkWishId(message, this.wishId);
                }
                message = utils.replaceUrl(message); //转换为自定义的 url格式
                var id = this.converse.sendMessage(message, null, isHiddenMsg);
                
                    if(isHiddenMsg !== true) {
                        this.showMessage({
                            fullname: this.converse.settings.get("myName"),
                            imageUrl: this.converse.settings.get("myImage") || defaultHeadImage,
                            sender: 'me',
                            message: message,
                            msgType: "1",
                            id: id
                        }, true, true);
                        
                        this.$msgInput.html('').focus();
                    }
               
                
                // if(this.enableLeaveMesage) {
                //     this.leaveMessage();
                // }
            }
        },
        leaveMessage: function() {
            this.lmconfig.lm_timing = setTimeout(this.leaveMessage.bind(this), 1000);

            if(this.lmconfig.timing === 30) {
                
                //需跟据类型显示不同的提示信息
                if(typeof this.coreSupplier === 'undefined') {
                    this.ifCoreSupplier();
                } else {
                    this.handleLeaveMessage();
                }
                
                clearTimeout(this.lmconfig.lm_timing);
                this.lmconfig.lm_timing = '';
                document.cookie = 'qchat_lm=' + this.strid + new Date().getTime();
                this.lmconfig.timing = 0;
                this.lmconfig.leaveMessage = false;
                return;
            }

            this.lmconfig.timing++;
        },
        handleLeaveMessage: function() {
            if(this.coreSupplier && !this.bindWechat) {
                $('.overview').append(msgTmpl_01);
            } else if(!this.coreSupplier && !this.bindWechat) {
                $('.overview').append(msgTmpl_03);
            } else {
                $('.overview').append(msgTmpl_02);
            }
        },
        /**
         * 暂无提供接口,是否是核心商家，是否关注了微信账号
         */
        ifCoreSupplier: function() {
            var me = this;
            $.ajax({
                url: '',
                type: 'GET',
                data: {
                    busiSupplierId: this.getQueryString('supplierId') || "", //供应商ID,
                    line: me.getQueryString("line") || "dujia" //业务线名称
                },
                dataType: 'jsonp'
            }).done(function(result) {
                me.coreSupplier = false;
                me.bindWechat = false;
                if(result.ret && result.data) {
                    me.coreSupplier = result.data.isCoreSupplier || false;
                    me.bindWechat = result.data.bindWechat || false;
                }
                me.handleLeaveMessage();
            }).fail(function() {
                me.coreSupplier = false;
                me.bindWechat = false;
                me.handleLeaveMessage();
            });
        },
        insertEmoticon: function(ev) {
            this.toggleEmoticonMenu();
            var $target = $(ev.target);
            $target = $target.is('img') ? $target : $target.children('img');
            utils.insertimg("  " + $target.prop('outerHTML'), document.getElementById("text"));
        },
        switchEmoticon: function(ev) {
            var $target = $(ev.target);
            $('.toggle-smiley ul').hide();
            this.emoticonIndex = $target.data('index');
            $('.toggle-smiley ul:eq(' + this.emoticonIndex + ')').show();
        },
        toggleEmoticonMenu: function() {
            $('.toggle-smiley').slideToggle(0);
            this.loadEmoticons();
            $('.toggle-smiley ul:eq(' + this.emoticonIndex + ')').show();
        },
        loadEmoticons: function() {
            var emotionContainer = $('.toggle-smiley');
            if(emotionContainer && emotionContainer.children().length < 1) {
                emotionContainer.append(utils.showEmoticons(DOWN_URL));
            }
        },
        clearMessages: function(skipConfirm) {
            var result = skipConfirm ? true : confirm("确定要清空吗？");
            if(result === true) {
                $('.overview').empty();
            }
            return this;
        },
        getQueryString: function(name) {
            var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
            var r = window.location.search.substr(1).match(reg);
            if(r != null) return decodeURIComponent(r[2]);
            return null;
        },
        renderRightBar: function(userQName) {
            var id = this.getQueryString('id') || '';
            var token = this.getQueryString('token') || '';
            var hideRBar = this.getQueryString('hideRBar');
            var bu_name = this.getQueryString("line") || ''; //业务线名称
            switch(bu_name) {
                //会场
            case "huichang":
                this.renderMeeting(id, bu_name);
                break;
                //会场(新的业务线改为编号)
            case "8":
                this.renderMeeting(id, bu_name);
                break;
            default:
                if(id) {
                    this.renderDetail(id, null, userQName);
                } else if(token) {
                    $('.slider_tab').hide();
                    this.renderOrder(token, null, userQName);
                } else if(hideRBar == '1') {
                    $('body').addClass('noRBar');
                } else {
                    this.noresult();
                }
            }
        },        
        /*
         * 加载右边栏信息
         */
        loadRightBar: function(url) {
            $('#right_sidebar').html('<iframe style="border: 0px;width: 100%;height: 100%;" src="' + url + '"></iframe>');
        },       
        /*
         * 渲染会场信息
         */
        renderMeeting: function(id, bu_name) {
            var self = this;
            
            var enSid = this.getQueryString('supplierId') || ""; //供应商ID
            var bType = 8; //buContainer[bu_name]; //业务线ID
            var tuId = this.getQueryString("tuId") || "";
            var t3id = this.getQueryString("t3id") || "";
            self.lm_info.enPid = id; //产品ID
            self.lm_info.enSid = enSid;
            var pd = {
                pdtId: id,
                bType: bType,
                source: "pc"
            };
            if(tuId) {
                pd.tuId = tuId;
            }
            if(t3id) {
                pd.t3id = t3id;
            }
            $.ajax({
                url: QCAdminApis.detailUrl,
                type: 'GET',
                dataType: 'jsonp',
                data: pd,
                jsonp: 'callback',
                success: function(data) {
                    if(data.ret && data.data) {
                        var result = data.data;
                        
                        var buTitle = result.buTitle || "客服"; //聊天窗口上方标题展示
                        var content = result.pHtml || ""; //HTML结构描述内容
                        self.lm_info.productTitle = buTitle;
                        
                        //聊天供应商名称
                        $("#supplierName").text(buTitle + " ");
                        
                        //隐藏右边tab
                        $("#slider_tab").hide();
                        
                        //聊天窗口上方标题
                        $("#chatTitle").text(buTitle);
                        
                        //渲染右边内容
                        $('.qt-product-message').append(content);
                    }
                },
                error: function() {
                }
            });
            
        },        
        /*
         * 功能：将产品图片域名http://img1替换成https://imgs
         * 参数：imgURL
         */
        httpImgToHttpsImg: function(imgURL) {
            if(imgURL) {
                return imgURL.replace(/http:\/\/img1/g, "https://imgs");
            }
        },
        
        prefixDetailData: function(data) {
            var dataObj = {};
            
            var m_price = data.marketPrice;
            var q_price = data.price;
            
            var mPrice = m_price;
            var qPrice = q_price.replace(/[\D]+/, '');
            var enId = this.getQueryString("id");
            var title = this.escapeHtml(data.title);
            var shortName = title.length > 40 ? title.slice(0, 40) + '...' : title;
            var fullName = data.title;
            var img = this.httpImgToHttpsImg(data.imageUrl) || '';
            var webUrl = data.webDtlUrl;
            var supplierName = data.supplier && data.supplier.shopName || '';
            var supplierId = data.supplier && data.supplier.enId || '';
            
            //是联运产品才会返回 出发地
            var isDep = false;
            var dep = "";
            if(data.dep) {
                dep = data.dep;
                isDep = true;
            }
            
            dataObj = {
                mPrice: mPrice,
                qPrice: qPrice,
                enId: enId,
                shortName: shortName,
                fullName: fullName,
                img: img,
                url: webUrl,
                supplierName: supplierName,
                dep: dep,
                isDep: isDep,
                supplierId: supplierId
            };
            return dataObj;
        },
        escapeHtml: function(str) {
            var i;
            if(str) {
                for(i = 0; i < symbol.length; i++) {
                    if(symbol[i].length >= 2) {
                        str = str.replace(symbol[i][0], symbol[i][1]);
                    }
                }
                return str;
            } else {
                return '';
            }
        },
        
        prefixOrderData: function(data) {
            var dataObj = {};
            dataObj.detailUrl = data.product_url;
            dataObj.pic = window.nav_igator.baseaddess.fileurl + '/' + data.main_pic;
            dataObj.title = data.title;
            dataObj.displayId = data.display_id;
            dataObj.price = data.payPrice ? data.payPrice : 0;
            dataObj.date = data.create_time_str;
            dataObj.payWay = data.pay_way_cn;
            dataObj.status = data.status_string;
            return dataObj;
        },
        // 右边栏 - 当前咨询
        renderDetail: function(id, businessId, userQName) {
            var self = this;
            // var buContainer = {
            //     'dujia': 1,
            //     'flight': 2,
            //     'hotel': 3,
            //     'local': 4,
            //     'menpiao': 5,
            //     'cheche': 6,
            //     'jijiu': 7
            // };
            var bu_name = this.getQueryString("line"); //业务线名称
            var enSid = this.getQueryString('supplierId');
            var bType = buContainer[bu_name];
            var url = QCAdminApis.detailUrl;
            
            self.lm_info.enPid = id;
            self.lm_info.enSid = enSid;
            
            //联运产品编号
            var tuId = this.getQueryString("tuId") || "";
            var t3id = this.getQueryString("t3id") || "";
            
            //请求参数
            var setting = self.setting;
            var _q = $.cookie('_q');
            var postData = {
                pdtId: id,
                bType: businessId || bType,
                sendNote: self.isFirstRenderRightBar,
                noteArgs: JSON.stringify({
                    seatQName: self.strid,
                    userQName: userQName || _q && _q.slice(2) || '',
                    bu: bu_name,
                    type: setting.service_type,
                    virtualId: setting.virtualId || '',
                    url: setting.service_url
                })
            };
            
            //如果是联运产品
            if(tuId) {
                postData.tuId = tuId;
            }
            if(t3id) {
                postData.t3id = t3id;
            }
            $.ajax({
                url: url,
                type: 'GET',
                dataType: 'jsonp',
                data: postData,
                jsonp: 'callback',
                success: function(data) {
                    
                    if(data.ret && data.data) {
                        self.isFirstRenderRightBar = false;
                        
                        // if (typeof(productCallback) === 'function') {
                        
                        //     //产品有tuId团期需增加
                        //     if (tuId) {
                        //         data.data.tuId = tuId;
                        //     };
                        
                        //     //发送给后端note信息
                        //     productCallback(data.data);
                        // } else {
                        
                        var dataFix = self.prefixDetailData(data.data);
                        self.lm_info.productTitle = data.data.title;
                        $('.qt-product-message').html(QTMPL.detail.render({
                            data: dataFix
                        }));
                        
                        // 缓存数据
                        self.cacheProductDetail[setting.virtualId || setting.strid] = dataFix;
                        //请求咨询历史
                        self.browseHistory.getHistoryProIds(dataFix.supplierId,userQName);
                        
                    } else {
                        self.noresult();
                    }
                },
                error: function() {
                    self.noresult();
                    
                }
            });
        },
        
        noresult: function() {
            $('.qt-product-message').html('<div class="no-history">没有找到您想要咨询的产品</div>');
        },
        renderOrder: function(token) {
            var me = this;
            $.ajax({
                url: me.hostConfig.order,
                type: 'GET',
                dataType: 'jsonp',
                data: {
                    token: token
                },
                success: function(data) {
                    if(data.ret && data.data && data.data.orderMap) {
                        var dataFix = me.prefixOrderData(data.data.orderMap);
                        $('.right_sidebar_container').append(QTMPL.order.render({
                            data: dataFix
                        }));
                    }
                },
                error: function() {
                
                }
            });
        },
        supportIE: function() {
            if(!Array.prototype.forEach) {
                
                Array.prototype.forEach = function(callback, thisArg) {
                    
                    var T, k;
                    
                    if(this == null) {
                        throw new TypeError(' this is null or not defined');
                    }
                    
                    var O = Object(this);
                    
                    var len = O.length >>> 0;
                    
                    if(typeof callback !== "function") {
                        throw new TypeError(callback + ' is not a function');
                    }
                    
                    if(arguments.length > 1) {
                        T = thisArg;
                    }
                    
                    k = 0;
                    
                    // 7. Repeat, while k < len
                    while(k < len) {
                        
                        var kValue;
                        
                        if(k in O) {
                            
                            kValue = O[k];
                            
                            callback.call(T, kValue, k, O);
                        }
                        
                        k++;
                    }
                    
                };
            }
        },
        
        //校验上传文件是否已存在了
        checkUpLoadFileExist: function(url, callback) {
            $.ajax({
                url: url,
                type: 'GET',
                dataType: 'json',
                data: {},
                jsonp: 'callback',
                success: function(data) {
                    //true代表文件不存在，可以上传
                    callback && callback(data);
                },
                error: function() {
                }
            });
        },
        
        /*
         * 发送消息
         * text:内容
         * msgType:消息类型
         */
        sendMsg: function(text, msgType) {
            var msgType = msgType || 4000;
            if (text) {
                var uuid = this.converse.sendMessage(text, msgType);
                this.showMessage({
                    fullname: this.converse.settings.get("myName"),
                    sender: 'me',
                    message: text,
                    imageUrl: this.converse.settings.get("myImage") || defaultHeadImage,
                    msgType: msgType,
                    id: uuid
                });
            }
        },
        
        /*
         * 设置会话标题
         * title:标题名称 必填项
         */
        setTitle: function(title) {
            var $setChatTitle = $("#chatTitle");
            $setChatTitle && $setChatTitle.text(title);
        },
        
        /* 
         * 获取订单信息
         * 1.C2B订单信息显示
         * 2.发送订单消息给后端
         * 3.请求提示语后端接口
         */
        getAddC2bOrderInfo: function(from, to) {
            var self = this;
            
            //获取各业务线小众自定义参数  C2B订单号
            var order_no = this.getQueryString("order_no") || "",
                config = null,
                seatId = this.getQueryString("seatId") || '',
                shopId = self.converse.settings.get('virtualId');

            if(order_no) {
                //配置参数
                config = {
                    
                    //回调方法主要用于发送订单、显示提示语信息
                    callback: function(retData) {
                        //sendMsg:发送给后端的订单内容
                        //retData.sendMsg;
                        
                        //发送C2B订单内容消息给后端
                        if(retData.sendMsg) {
                            
                            //发订单消息
                            self.converse.sendOrderMessage(retData.sendMsg, 0);
                            
                            //显示订单信息
                            self.showMessage({
                                fullname: self.converse.settings.get("myName"),
                                sender: 'me',
                                message: "",
                                imageUrl: self.converse.settings.get("myImage") || defaultHeadImage,
                                msgType: "888",
                                extendInfo: retData.sendMsg
                            }, true, true);
                        }
                    }
                };
            }
            
            //输入参数
            //订单号
            //当前用户ID myid
            //客服ID strid
            //虚拟ID virtualId
            var data = {
                order_no: order_no,
                from: from || "",
                to: to || "",
                line: this.business_name || '',
                seatId: seatId || '',
                virtualId: shopId || '',
                seatHost: self.setting.toDomain || window.nav_igator.baseaddess.domain
            };
            
            //调用获取C2B订单消息
            c2bOrderInfo.init(data, config);
        },
        // 这里需要发给qchat后台本地聊天建立的确认消息
        sendChatConfirm: function() {
            var self = this;
            if(!this.strid || !this.seatId) {
                return;
            }

            $.ajax({
                url: QCAdminApis.chatReadyConfirm,
                type: 'GET',
                dataType: 'jsonp',
                data: {
                    seatId: this.seatId,
                    qunarName: this.strid
                },
                success: function(resp) {
                    if(resp && resp.ret) {}  
                },
                error: function() { }
            });
        }   
    }
    
    var outMsgTime;
    var qChatInstance = new ChatPage();
    qChatInstance.init();
    
    //初始化业务消息处理
    businessMessage.init();
    
    //输出对接口方法
    if(window.QCHAT) {
        
        /*
         * 渲染酒店业务右边的信息
         * url地址
         */
        window.QCHAT.loadRightBar = function(url) {
            if(!url) return;
            
            qChatInstance.loadRightBar(url);
        };
        
        /*
         * 发送消息方法
         * text:消息内容 必填项
         * msgType: 消息类型
         */
        window.QCHAT.sendMsg = function(text, msgType) {
            if(!text) {
                return
            }
            
            var now = new Date();
            if(outMsgTime && (now - outMsgTime < 200)) {
                // alert('发送消息太频繁');
                return false;
            }
            outMsgTime = now;
            
            qChatInstance.sendMsg(text, msgType);
        };
        
        /*
         * 设置会话标题
         * title:标题名称 必填项
         */
        window.QCHAT.setTitle = function(title) {
            if(!title) {
                return
            }
            
            qChatInstance.setTitle(title);
        }
        
    }    
});