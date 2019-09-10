(function() {
    require('tmpl/touch/qchat.mustache');
    require('tmpl/touch/msg.mustache');
    require('tmpl/touch/productDetail.mustache');
    require('lib/swiper/swiper.js');
    require('lib/qevent/index.js');
    require('lib/extension/function.js');

    var qchatCore = require('qchat/qchat-core.js');
    var browserHistory = require('browser-history.js');
    var sniff = require('lib/sniff/sniff.js');
    var QunarAPI = require('QunarAPI');
    var LeaveMessage = require('./leaveMessage.js');
    var captcha = require('../../common/captcha.js');
    var utils = require('utils/utils.js');
    require('./sendMessage.mustache');
    
    var businessMessage = require('../../web/qchat/businessMessage.js'); // 业务消息处理

    var c2bOrderInfo = require('common/c2bOrderInfo.js'); // 获取C2B订单信息

    var unreadTip = require('./unreadTip/index');
    
    var smartRobot = require('common/smartRobot');
    var notify = require('common/notify');

    var ConnectionStatus = qchatCore.ConnectionStatus;

    var NO_MORE = '没有更多消息了';
    var LM_REGEXP = /(微信|QQ|手机号|(\+*86|0)?1[358]{9})/ig; // 关键词过滤规则
    var LEAVE_MESSAGE_01 = '<p class="lm-info">客服忙碌，您可以发送联系方式给商家，商家会第一时间联系您！</p>';
    var LEAVE_MESSAGE_02 = '<p class="lm-info">如需客服电话联系您，可以发送联系方式给客服，客服看到后会第一时间联系您哦！</p>';
    var DOWN_URL = window.nav_igator.baseaddess.fileurl;
    var XMPP_URL = window.nav_igator.baseaddess.xmpp;
    var imageUpload_url = window.nav_igator.baseaddess.fileurl;
    var showImg_url = window.nav_igator.baseaddess.fileurl;
    var sendwap_url =  '/qcadmin/api/setids';

    var QCAdminApis = {
        // rightbar的detail展示数据
        detailUrl: '/qcadmin/api/pdt/productDtl.qunar',
        // 暂无提供接口,更新客服开始最近一个会话的时间
        chatReadyConfirm: ''
    };
    var bosh_service_url = '/http-bind/';
    var http_api_server = XMPP_URL + 'api/';
    var loginDialog = require('./loginDialog.js');
    var show_time_old, show_time_new;
    var show_msg_interval = 1000 * 60 * 2;

    var uploadFileSizeLimit = {
        size: 1024 * 1024 * 5,
        text: '2 MB'
    };

    var IS_DEBUG = false;
    var IS_CLIENT = sniff.qunar;
    var IS_ANDROID_OLD = false;

    // 平台类型 web:6,touch:7(touch区分设备类型: iphone:8,ipod:9,ipad:10, android:11)
    var maType = 7;
    if (sniff.iphone) {
        maType = 8;
    } else if (sniff.ipod) {
        maType = 9;
    } else if (sniff.ipad) {
        maType = 10;
    } else if (sniff.android) {
        maType = 11;
    };

    var ChatPage = function() {
        this.supportZuji = (this.getQueryString('line') == 'dujia') ? true : false;
        this.html = QTMPL.qchat.render({
            ifApp: IS_CLIENT,
            ifAdaptation: IS_ANDROID_OLD,
            supportZuji: this.supportZuji
        });

        this.shopId = this.getQueryString('shopId') || '';
        this.converse = qchatCore.converse || {};
        this.utils = QNR.utils = require('utils/utils_touch.js').utils;

        this.useWebSocket = this.getQueryString('usews') === '1';
        //debugger
        // 检查是否支持web socket协议；如果支持切换到web socket
        if(utils.isSupportWebSocket()) {
            bosh_service_url = 'ws:' + XMPP_URL + '/websocket';
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
        this.strid = ''; // 当前聊天的客服，留言使用
        this.lm_info = {};
        this.$textarea = $('#text');
        this.textarea = this.$textarea[0];

        // 留言相关配置
        this.lmconfig = {
            leaveMessage: false,
            lm_timing: '', // 留言计时器
            timing: 0, // 留言计时
            head: '//u.package.qunar.com/user/message',
            getMobile: '/getMobileFromRequest.json',
            sendMessage: '/saveMessage.qunar',
            getCode: '/sendMobileCode.json'
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
        config: function() {
            var self = this;
            var uin = this.getQueryString("uin");
            var strid = this.getQueryString("strid");
            var seatId = this.getQueryString("seatId") || "";
            var bu_name = this.getQueryString("line") || "";
            var service_type = this.getQueryString("service_type") || "0";
            var url = this.getQueryString("url");
            // var anonymousFlag = this.getQueryString('anony') === '1';
            
            var isAnonymous = !loginDialog.isLogin() && true;
            var ipAddress = QNR && QNR.chatData && QNR.chatData.ip || '';
            strid = (strid && strid.toLowerCase()) || (uin && this.stridForLocal[uin]) || "";
            // 应刘帆要求，处理和XMPP关键字冲突的符号 -- baotongw
            strid = strid.replace('@', '[at]');

            if (!strid) {
                alert('您未指定当前聊天对象');
                return
            }

            this.strid = strid;
            this.seatId = seatId;

            //上次留言时间
            var qchat_lm = $.cookie("qchat_lm");
            var qchat_lm_time;
            if (qchat_lm && qchat_lm.split('_').length > 1) {
                qchat_lm_time = parseInt(qchat_lm.split('_')[1]);
            }

            // 聊天类型：1-和qtalk聊天；2-和qchat聊天
            var toDomain = this.getQueryString("toDomain");
            if (toDomain == '1') {
                // beta的qtalk toDomain baotongw - 2016-07-12
                this.setting.toDomain = 'ejabhost1';

                // 不属于售前售后
                service_type = null;
            }

            if (bu_name === 'dujia' && (!qchat_lm || qchat_lm_time + 24 * 60 * 60 < new Date().getTime())) {
                this.lmconfig.leaveMessage = true;
            }

            if (/^null$/i.test(url)) {
                url = '';
            }
            var options = {
                strid: strid,
                seatId: seatId,
                bu_name: bu_name,
                service_type: service_type,
                service_url: url,
                chatType: 'touch',
                maType: maType,
                ipAddress: ipAddress,
                domainType: toDomain,
                isAnonymous: isAnonymous,
                useWebSocket: this.useWebSocket
            };
            var isRobot = this.getQueryString('isrobot'),
                pid = this.getQueryString('pid') || '',
                bsid = this.getQueryString('bsid') || '',
                backupinfo = [{
                    type: 50010,
                    data: {
                        bu: bu_name,
                        pid: pid,
                        bsid: bsid
                    }
                }];
                if (bu_name === "jijiu") {
                    backupinfo = [{
                        type: 50010,
                        data: {
                            bu: bu_name,
                            pid: pid,
                            bsid: '1'
                      }
                    }]
                }
            isRobot && (options.backupinfo = backupinfo)
            
            this.shopId && (options.virtualId = this.shopId);
            options.isUCenter = isAnonymous ? false : true;

            this.business_name = bu_name; //业务名称
            this.isDujia = bu_name === 'dujia'

            $.extend(this.setting, options || {});

            // 已登陆或者开启了匿名登陆都直接初始化
            // loginDialog.isLogin()|| isAnonymous
            if(true) {
                this.initConverse();
            } else {
                loginDialog.run(this.initConverse.bind(this));
            }

            this.shopId && (this.converse.setStridContainer([this.shopId]));
            
            smartRobot.questionSuggest.init({
                startRobot: isRobot,
                bsid: bsid || '',   // 店铺id
                bu: bu_name || 'dujia',    // 业务线id
                pid: pid || '' // 当前咨询产品id
            });
            smartRobot.robotChat.init(isRobot, {
                chatObj: this,
                switchContact: function(params) {
                    // leftBar.switchContact({
                    //     strid: params.strid,
                    //     virtualId: params.shopId,
                    //     webName: params.webName,
                    //     shopName: params.shopName,
                    //     host: 'ejabhost2'
                    // });
                    var url = utils.updateQueryString(location.href, 'strid', params.strid);
                    url = utils.updateQueryString(url, 'isrobot', '');
                    location.href = url;
                },
                showMoreCallback: function() {
                    self.pageScroll.refresh(); 
                }
            });

            return this;
        },
        initConverse: function() {
            if (this.converse && this.converse.initialize) {
                this.converse.initialize(this.setting, {
                    onAuthDone: this.onAuthDone.bind(this),
                    onAuthFail: this.onAuthFail,
                    onMsgCallback: this.showMessage.bind(this),
                    onStatusChangeCallback: this.onStatusChange,
                    onHistory: this.onHistory,
                    onHistoryPatch: this.onHistoryPatch,
                    onCard: this.onCard.bind(this),
                    // onGetC2bOrderCallback: this.getAddC2bOrderInfo,
                    sendWapInfo: IS_CLIENT ? this.initQunarApi : false,
                    runContext: this,
                    onChatReady: this.onChatReady.bind(this),
                    onSendMsgLock: this.onSendMsgLock.bind(this),
                    onMsgLockCheck: this.onMsgLockCheck.bind(this)
                });
            }
        },
        // qchat token 验证成功
        onAuthDone: function(param) {
            this.userQName = param.username;
        },
        // qchat token 验证失败
        onAuthFail: function(msg) {
            // 匿名登陆失败之后，切到普通登陆
            if (qChatInstance.setting.isAnonymous) {
                qChatInstance.setting.isAnonymous = false;
                qChatInstance.setting.isUCenter = true;
            }

            loginDialog.run(qChatInstance.initConverse.bind(qChatInstance));
        },
        onSendMsgLock: function() {
            captcha.open();
        },
        onMsgLockCheck: function(status) {
            // 验证成功，放开了消息发送
            // 这里UI部分放开
            switch (status) {
                case true:
                    captcha.close();
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
        onChatReady: function(myId, key) {
            var uid = myId,
                t = new Date().getTime() + '',
                q_ckey = Base64.encode('u=' + uid + '&k=' + MD5.hexdigest(key + t).toUpperCase() + '&t=' + t);
            document.cookie = 'q_ckey=' + q_ckey + '; path=/;'
            
            this.getHistory(20);
            var dmsg = this.getQueryString('dmsg');

            if (dmsg && this.strid) {
                this.getInputAndSend(decodeURIComponent(dmsg));
            }

            if (this.shopId) {
                this.getShopName(this.shopId);
            }

            //获取C2B订单
            this.getAddC2bOrderInfo(this.strid, myId);

            this.addProductDetail(myId);
            this.sendChatConfirm();
        },
        init: function() {
            this.initTitle();
            this.initThis();
            var self = this;
            $('body').append(this.html);

            if (this.supportZuji) {
                new browserHistory();
            }

            captcha.init(this.converse.checkCaptchaCode);
     
            //微信分享URL传过来的参数：主要用于判断返回列表
            var golist = this.getQueryString("golist") || "";

            //var ua=this.utils.getUA();
            if (!IS_CLIENT) {
                document.title += "-连接中"; //ios webview title 不刷新
                //if(ua.h5){
                $(".header").show();
                $(".goback").click(function(e) {

                    //如果是微信分享过来的URL地址上有这个参数返回到联系人列表
                    if (golist == "1") {
                        window.location = '//qcweb.qunar.com/webchat/conlist';
                    } else {
                        history.go(-1);
                    }
                });
            }
            //}
            //}

            this.config();

            var edt = document.getElementById("text");

            $("#text").on('keypress', function(e) {
                var eve = e || window.event;
                if (eve.keyCode == 13) {
                    eve.preventDefault();
                    self.getInputAndSend();
                }
            }).on('focus', function(e) {
                setTimeout(function() {
                    if (sniff.ios && document.body.scrollTop < 100) {
                        document.body.scrollTop = '280';
                    } else {
                        self.$footer.css('bottom', '1px');
                        document.body.scrollTop; //使渲染树队列刷新，立即使以上方法生效
                    }
                }, 500);
                if (this.value !== '') {
                    self.$sendMessageHandler.show();
                    self.$operationResource.hide();
                }
                if (self.$displayFace.is(":visible")) {
                    self.$displayFace.hide();
                    if (sniff.ios) {
                        this.blur();
                    }

                }

            }).on('blur', function() {
                setTimeout(function() {
                    self.$footer.css('bottom', '0');
                }, 20);
            }).on('input', function() {
                if (this.value !== '') {
                    self.$operationResource.hide();
                    self.$sendMessageHandler.show();
                    smartRobot.questionSuggest.startSuggest(edt.value);
                } else {
                    self.$operationResource.show();
                    self.$sendMessageHandler.hide();
                }
            });

            $(window).on('resize', function() {
                $('.m-chat').hide();
                _delay(function() {
                    $('.m-chat').show();
                }, 10);

            });

            $("#more_msg").click(function(e) {
                e.preventDefault();
                this.getHistory();
            }.bind(this));
            $("#submit").click(function(e) {
                e.preventDefault();
                this.getInputAndSend();
            }.bind(this));
            $(".ipt-face").click(function(e) {
                e.preventDefault();
                this.toggleEmoticonMenu();

            }.bind(this));

            $('.toggle-smiley').on('click', 'dd', function(e) {
                e.preventDefault();
                this.switchEmoticon(e);
            }.bind(this)).on('click', 'li', function(e) {
                this.insertEmoticon(e);
            }.bind(this));
            
            if(typeof window.onbeforeunload !== 'undefined') {
                window.onbeforeunload = function() {
                    qchatCore.converse.disconnect();
                }
            } else if(typeof window.onunload !== 'undefined') {
                window.onunload = function() {
                    qchatCore.converse.disconnect();
                }
            }
        },
        initThis: function() {
            $(function() {
                //做当前页面对象的缓存
                this.$operationFace = $('.ipt-face');
                this.$displayFace = $('.toggle-smiley');

                this.$operationText = $('#text');
                this.$operationSend = $('.ipt-btn');

                this.$operationResource = $('.ipt-resource');
                this.$sendMessageHandler = $('.ipt-send');
                this.$displayResource = $('.toggle-resource');
                this.$imgManager = $('.swiper-wrapper');
                this.$chatContent = $('.m-chat');
                this.$swiperContainer = $('#js_img_detail');
                this.$pageHandler = $('.swiper-pagination');

                this.$operationDisplay = $('.ops-display');

                this.$footer = $('#footer');

                this.clientSupportUploadImg = false;
                this.swiperIndex = -1;

                this.initScroll();

                this.initImageUpload();

                this.initSwiper();

                this.bindEvent();

            }.bind(this));
        },
        initSwiper: function() {

            this.imgSwiper = new Swiper('.swiper-container', {
                pagination: '.swiper-pagination',
                paginationClickable: true,
                spaceBetween: 30
            });

        },

        //获取用户信息
        getUserInfo: function(callback) {
            var self = this;
            var qunarName = document.cookie.match(/(^|\s)_q=([^;]*)(;|$)/i);
            var ts = new Date().getTime();
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
                .done(function(result) {
                    if (result.ret) {
                        self.lmconfig.hasMobile = true;
                    }
                    callback.call(self, result.data);
                })
                .fail(function(result) {
                    callback.call(self, result.data);
                })
        },

        //初始化留言框
        showLeaveMessage: function(data) {
            var self = this,
                config;
            if (!data) {
                data = {};
                data.name = '用户';
            }
            this.lmconfig.imgUrl = this.converse.settings.get("myImage");
            this.lmconfig = $.extend({
                name: data.name,
                mobile: data.mobile
            }, this.lm_info, this.lmconfig)
            $('#msg_list').append(QTMPL.sendMessage.render({
                data: this.lmconfig
            }));
            setTimeout(function() {
                self.pageScroll.refresh();
                self.pageScroll.scrollTo(0, self.pageScroll.maxScrollY);
            }, 0);
        },

        addProductDetail: function(userQName) {
            var bu_name = this.getQueryString("line"), //业务线名称
                id = this.getQueryString("id"),
                touchDtlUrl = this.getQueryString('url'),
                shopId = this.getQueryString('shopId'),
                self = this,
                url = QCAdminApis.detailUrl,
                dataFix = "",
                $content = $('#msg_list');

            var whiteList = {
                dujia: '1',
                flight: '2',
                hotel: '3',
                local: '4',
                menpiao: '5',
                cheche: '6',
                jijiu: '7',
                huichang: '8',
                train: '9',
                interTrain: '901',
                bus: '11'
            };

            var buId = whiteList[bu_name];
            var _q = $.cookie('_q');
            var tuId = this.getQueryString("tuId") || "";
            var t3id = this.getQueryString("t3id") || "";
            var pd = {
                pdtId: id,
                bType: buId,
                source: 'touch',
                sendNote: true,
                noteArgs: JSON.stringify({
                    seatQName: self.strid,
                    userQName: userQName || _q && _q.slice(2) || '',
                    bu: bu_name,
                    type: self.converse.settings.get('service_type'),
                    url: touchDtlUrl || '',
                    virtualId: shopId || ''
                })
            };
            if(tuId) {
                pd.tuId = tuId;
            }
            if(t3id) {
                pd.t3id = t3id;
            }
            if (buId && id) {
                $.ajax({
                    url: url,
                    type: 'GET',
                    dataType: 'jsonp',
                    data: pd,
                    jsonp: 'callback',
                    success: function(data) {
                        if (data.ret && data.data) {
                            dataFix = self.prefixProductData(data.data);
                            $content.append(QTMPL.productDetail.render({
                                data: dataFix
                            }));
                        }
                    },
                    error: function() {

                    }
                });
            }
        },

        handleImgUrl: function(img) {
            var protocal = location.protocol;
            if (img) {
                if (protocal.indexOf('https:') >= 0) {
                    img = img.replace(/^(http|https):/, '');
                    img = img.replace(/^\/\/[^/]+/, window.nav_igator.baseaddess.fileurl);
                } else if (protocal.indexOf('http:') >= 0) {
                    img = img.replace(/^(http|https):/, '');
                    img = img.replace(/^\/\/[^/]+/, window.nav_igator.baseaddess.fileurl);
                }
                return img;
            } else {
                return "";
            }

        },

        prefixProductData: function(data) {
            var imgUrl = this.handleImgUrl(data.imageUrl);
            var price = data.price && data.price.match(/([/\d]+\.?\d*)([/\D]*)/) || '';
            var url = data.touchDtlUrl;

            var dataObj = {
                qPrice: price && price[1] || '',
                unit: price && price[2] || '',
                title: data.title,
                tag: data.tag,
                img: imgUrl,
                type: data.type,
                url: url
            }
            return dataObj;
        },

        bindEvent: function() {
            var self = this;

            QNR.qevent.on("QunarAPIInitDone", function() {
                self.clientSupportUploadImg = true;
            });

            QNR.qevent.on('initImg', function(imgUrl, obj) {
                var img = new Image();
                img.src = imgUrl;
                img.onload = function() {
                    $(obj).html(img);
                    //$('[data-imgsrc="' + imgUrl.replace('/&amp;/ig', '&') + '"]').parent().parent().html(img);
                    QNR.qevent.fire('refreshScroll');
                };
            });

            QNR.qevent.on('addImg', function(imgUrl, obj) {
                var slider = [],
                    index = self.swiperIndex = self.swiperIndex + 1;

                obj.parentNode.className = 'txt-img';
                obj.innerHTML = '';
                $(obj).parent().css({
                    'background': 'url("' + imgUrl + '") center center / .9rem .67rem no-repeat'
                }).attr('swiperIndex', index);

                slider.push('<div class="swiper-slide">');
                slider.push('<img src="' + imgUrl + '" />');
                slider.push('</div>');
                self.$imgManager.append(slider.join(''));
                self.imgSwiper.update();

            });

            self.$chatContent.on('click', '.txt-img', function() {
                var index = parseInt(this.getAttribute('swiperindex'));
                //self.imgSwiper.update();
                typeof index == 'number' && self.imgSwiper.slideTo(index, 1, false);
                self.$pageHandler.show();
                setTimeout(function() {
                    self.$swiperContainer.css('visibility', 'visible');
                }, 20);
            });

            self.$chatContent.on('click', '.js_writeInfo', function() {
                $('#text').blur();
                $('.m-success').hide();
                $('.m-fail').hide();
                self.lmconfig.sendAuto = false;
                LeaveMessage.init(self.lmconfig, self);
            });

            self.$chatContent.on('click', '.js_sendMessage', function() {
                self.lmconfig.sendAuto = true;
                LeaveMessage.init(self.lmconfig, self);
            });

            self.$swiperContainer.on('click', function() {
                self.$pageHandler.hide();
                this.style.visibility = 'hidden';

            });

            self.$sendMessageHandler.on('click', function() {
                self.getInputAndSend();
            });

        },

        //初始化图片上传(touch只有上传图片场景)
        initImageUpload: function() {
            var self = this;

            $(document).on('click', '.ipt-resource', function() {

                var u = self.converse.settings.get("myName");
                var k = self.converse.settings.get("key");
                var url = "";
                var picFileName = "";

                if (IS_CLIENT && self.clientSupportUploadImg) {

                    QunarAPI.ready(function() {
                        QunarAPI.chooseImage({
                            count: 1,
                            sizeType: ["original"],
                            sourceType: ["album", "camera"],
                            success: function(result) {
                                // 返回选定照片的本地ID列表，localId可以作为img标签的src属性显示图片

                                var localIds = result.localIds || "";

                                var localfileNames = JSON.stringify(localIds);

                                //获取文件名称/前面的目录去掉
                                var idx = localfileNames.lastIndexOf("/");
                                if (idx > 0) {
                                    localfileNames = localfileNames.substr(idx + 1); //获取
                                    localfileNames = localfileNames.replace(/\"]/ig, ""); //去掉
                                }
                                var key = $.md5(self.utils.createUUID()); // $.md5(localfileNames); //文件名md5加密唯一标识

                                var fileSize = "46"; //写死为46M=1024*1024*46
                                var paramLink = "name=" + localfileNames + "&size=" + fileSize + "&u=" + u + "&k=" + k + "&key=" + key + "&p=qim_touch";
                                url = "/file/v2/upload/img?" + paramLink;

                                //校验上传的图片是否存在
                                //如果图片存在了就不上传了，直接显示为和上传成功的效果
                                var checkFileUrl = "/file/v2/inspection/img?" + paramLink;
                                //debugger
                                self.checkUpLoadFileExist(checkFileUrl, function(resultData) {

                                    var msg, imgUrl, $msgTml;

                                    //图片不存在上传图片
                                    if (resultData.ret) {

                                        //调用native接口上传图片
                                        QunarAPI.uploadImage({
                                            localId: localIds,
                                            isShowProgressTips: 1,
                                            serverAddress: url,
                                            fileKey: "file",
                                            quality: "middle", // 图像品质
                                            success: function(res) {
                                                $msgTml = $(QTMPL.msg.render({
                                                    sender: true,
                                                    time: new Date().format1('MM-dd hh:mm:ss'),
                                                    username: self.converse.settings.get("myName"),
                                                    imageUrl: self.converse.settings.get("myImage"),
                                                    message: localIds,
                                                    webSenderName: self.converse.chatName,
                                                    // webMyName: self.converse.myNickName,
                                                    'webMyName': qChatInstance.setting.isAnonymous?"我":self.converse.myNickName,
                                                    'webYourName': self.converse.myNickName,
                                                    imgMessage: true
                                                }));

                                                imgUrl = res.serverId || ""; //后端返回的完整的图片地址

                                                $msgTml.appendTo('#msg_list');

                                                msg = '[obj type="image" value="' + imgUrl + '"]';
                                                self.converse.sendMessage(msg);

                                                QNR.qevent.fire('addImg', imgUrl, $msgTml.find('p')[0]);

                                                setTimeout(function() {
                                                    QNR.qevent.fire('refreshScroll');
                                                    QNR.qevent.fire('reachBottom');
                                                }, 500);

                                            },
                                            fail: function(res) {
                                                alert("上传图片失败");
                                            }
                                        });

                                    } else { //文件已存在直接显示

                                        //图片地址
                                        imgUrl = resultData.data;
                                        $msgTml = $(QTMPL.msg.render({
                                            sender: true,
                                            time: new Date().format1('MM-dd hh:mm:ss'),
                                            username: self.converse.settings.get("myName"),
                                            imageUrl: self.converse.settings.get("myImage"),
                                            message: localIds,
                                            webSenderName: self.converse.chatName,
                                            // webMyName: self.converse.myNickName,
                                            'webMyName': qChatInstance.setting.isAnonymous?"我":self.converse.myNickName,
                                            'webYourName': self.converse.myNickName,
                                            imgMessage: true
                                        }));

                                        $msgTml.appendTo('#msg_list');

                                        msg = '[obj type="image" value="' + imgUrl + '"]';
                                        self.converse.sendMessage(msg);

                                        QNR.qevent.fire('addImg', imgUrl, $msgTml.find('p')[0]);

                                        setTimeout(function() {
                                            QNR.qevent.fire('refreshScroll');
                                            QNR.qevent.fire('reachBottom');
                                        }, 500);
                                    } //end if 

                                });

                            },
                            fail: function(res) {
                                //alert("选择图片失败");
                            }
                        });
                    });

                } else if (IS_CLIENT && !self.clientSupportUploadImg) {

                    alert("您的客户端不支持上传图片");

                } else {

                    //上传组件
                    $(this).fileupload({
                        dropZone: undefined,
                        url: "",
                        dataType: 'json',
                        autoUpload: false,
                        forceIframeTransport: false,
                        limitMultiFileUploadSize: uploadFileSizeLimit.size,
                        add: function(e, data) {
                            data.process().done(function() {

                                $.each(data.files, function(index, file) {

                                    var key = $.md5(self.utils.createUUID()); //$.md5(file.name); //文件名md5加密唯一标识
                                    var sizeMB = self.utils.bytesToMB(file.size);
                                    var paramLink = "name=" + file.name + "&size=" + sizeMB + "&u=" + u + "&k=" + k + "&key=" + key + "&p=qim_touch";
                                    var url = "/file/v2/upload/img?" + paramLink;

                                    if (file.size > uploadFileSizeLimit.size) {
                                        alert("图片大小不能超过 " + uploadFileSizeLimit.text);
                                        return;
                                    }

                                    //组件方法：设置新的提交地址
                                    data.setSubmitURL(url);

                                    //校验上传的文件是否存在
                                    //如果文件存在了就不上传了，直接显示为和上传成功的效果
                                    var checkFileUrl = "/file/v2/inspection/img?" + paramLink;

                                    self.checkUpLoadFileExist(checkFileUrl, function(resultData) {
                                        var msgTml = QTMPL.msg.render({
                                            sender: true,
                                            time: new Date().format1('MM-dd hh:mm:ss'),
                                            username: self.converse.settings.get("myName"),
                                            imageUrl: self.converse.settings.get("myImage"),
                                            message: file.name,
                                            imgMessage: true,
                                            webSenderName: self.converse.settings.get('chatName'),
                                            // webMyName: self.converse.settings.get('myNickName')
                                            'webMyName':qChatInstance.setting.isAnonymous?"我":self.converse.settings.get('myNickName'),
                                            'webYourName': self.converse.settings.get('myNickName')
                                        });
                                        data.context = $(msgTml).appendTo('#msg_list');
                                        $(data.context).find('p').first().addClass('imgloading').append('<i class="yo-ico yo-ico-loading"></i><span class="number">0</span>%');

                                        //文件不存在
                                        if (resultData.ret) {
                                            //提交上传文件
                                            data.submit();
                                        } else {
                                            //文件已存在了直接显示上传成功效果
                                            //存在的文件URL地址
                                            var result = resultData.data;
                                            var imgUrl = result;
                                            var msg = '[obj type="image" value="' + result + '"]';

                                            self.converse.sendMessage(msg);
                                            $(data.context).find('p').html('').removeClass('imgloading');
                                            $(data.context).find('.txt-img').css({
                                                'background': 'url("' + imgUrl + '") center center / .9rem .76rem no-repeat'
                                            });
                                            $(data.context).find('.number').text(100);
                                            QNR.qevent.fire('addImg', imgUrl, $(data.context).find('p')[0]);
                                        }

                                        QNR.qevent.fire('refreshScroll');
                                        QNR.qevent.fire('reachBottom');
                                    });
                                });
                                //self.toggleResourceMenu();
                                // QNR.qevent.fire('refreshScroll');
                                // QNR.qevent.fire('reachBottom');
                                //data.submit();
                            });
                            //self.scrollBottom();
                        },
                        done: function(e, data) {
                            var result = data.result.data;
                            var imgUrl = result;
                            var msg = '[obj type="image" value="' + result + '"]';

                            self.converse.sendMessage(msg);
                            $(data.context).find('p').html('').removeClass('imgloading');
                            $(data.context).find('.txt-img').css({
                                'background': 'url("' + imgUrl + '") center center / .9rem .76rem no-repeat'
                            });
                            QNR.qevent.fire('addImg', imgUrl, $(data.context).find('p')[0]);
                        },
                        progress: function(e, data) {
                            var progress = parseInt(data.loaded / data.total * 100, 10);
                            $(data.context).find('.number').text(progress);
                        }

                    });
                }

            });
        },
        toggleResourceMenu: function() {
            var $el = this.$displayResource;
            if ($el.is(':visible')) {
                $el.hide();
            } else {
                $el.siblings().hide();
                $el.show();
            }
        },
        getUploadUrl: function(client) {
            if (this.converse.settings.get("key")) {
                if (client) {
                    this.uploadUrl = [imageUpload_url, "cgi-bin/file_upload.pl?user=",
                        this.converse.settings.get("myName"),
                        "&tkey=",
                        this.converse.settings.get("key"), "&fm=json"
                    ].join('');
                } else {
                    this.uploadUrl = [imageUpload_url, "cgi-bin/file_upload.pl?user=",
                        this.converse.settings.get("myName"),
                        "&tkey=",
                        this.converse.settings.get("key")
                    ].join('');
                }
            } else {
                this.uploadUrl = '';
            }

            return this.uploadUrl;

        },
        scrollBottom: function() {
            var $view = $('.m-chat');
            if ($view.is(':visible')) {
                $view.scrollTop($view[0].scrollHeight);
            }
        },
        onStatusChange: function(status) {
            var txt = ""
            var $status = $("#status");
            if (status == ConnectionStatus.CONNECTED) {
                txt = "已连接";
            } else if (status == ConnectionStatus.DISCONNECTED) {
                txt = "连接断开";
            } else if (status == ConnectionStatus.CONNECTING) {
                txt = "连接中";
            }
            if ($status) {
                $status.text(txt);
            }
            if (document.title.indexOf("-") > 0) {
                document.title = document.title.substring(0, document.title.lastIndexOf("-") + 1) + txt;
            }
        },
        getHistory: function() {
            if ($("#more_msg").text() != NO_MORE && !this.historying) {
                this.historying = true;
                this.converse.getHistory(20, this.shopId || this.strid);
                $("#loading").show();
                $("#more_msg").hide();
            }
        },
        onCard: function(data, isMe) {
            if (data) {
                if (isMe) {
                    $(".u-pic1").css({
                        'background-image': 'url(' + data.imageurl + ')'
                    });
                    $(".txt-name-right").text(data.nickname);
                } else if (data.username === this.strid) {
                    var name = data.nickname ? data.nickname : data.username;

                    if (this.shopId) {
                        $("#status").text(name);
                        document.title = $("#chatName").text() + '-' + name;
                    } else {
                        $("#chatName").text(name);
                        document.title = name + document.title.substring(document.title.lastIndexOf("-"));
                    }
                    $(".u-pic").css({
                        'background-image': 'url(' + data.imageurl + ')'
                    });
                }
            }
        },
        onHistory: function(msg, ifFirst) {
            var self = this;
            setTimeout(function() {
                $("#loading").hide();
                $("#more_msg").show();
                if (!msg.hasMore) {
                    $("#more_msg").text(NO_MORE).css("text-decoration", "none");
                }

                QNR.qevent.fire('refreshScroll');
                QNR.qevent.fire('historyIng');
                if (ifFirst) {
                    QNR.qevent.fire('reachBottom');
                }
            }, 20);
        },

        onHistoryPatch: function(msgs) {

        },
        setChatWindowTitle: function(shopName, consultName) {
            var $supplierName = $('#chatName'),
                $chatName = $('#status');
            if(shopName) {
                typeof shopName === 'string' && $supplierName.text(shopName);
                $chatName.text(consultName);
            } else {
                $supplierName.text(consultName);
            }
        },

        // 注意：消息格式变动touch/WEB端两边的showMessage需要修改
        // 改为兼容单条消息和多条消息的格式
        // onHistory我改成了多条，这样只执行一次append或者prepend        
        showMessage: function(msg_dict, ifSend) {
            var list = msg_dict,
                appendList = [],
                prependList = [],
                self = this;
          
            if (Object.prototype.toString.call(msg_dict) === '[object Object]') {
                list = [msg_dict];
            }

            var $content = $('#msg_list');
            var currentStrid = self.converse.settings.get('strid');

            for (var i = 0, msg_dict, len = list.length; i < len; i++) {
                msg_dict = list[i];

                var msg_time = msg_dict.stamp || new Date().toString(),
                    msg_type = msg_dict.msgType,
                    text = msg_dict.message,
                    fullname = msg_dict.fullname,
                    imageUrl = msg_dict.imageUrl,
                    extra_classes = msg_dict.delayed && 'delayed' || '',
                    username = fullname,
                    myWebName = msg_dict.myWebName || fullname,
                    chatName = msg_dict.chatName,
                    extendInfo = msg_dict.extendInfo || '',
                    isSysMsg = false,
                    isMe = msg_dict.sender == 'me';

                // 屏蔽其他人消息
                if (!isMe) {
                    if (+msg_type === 1 &&
                        ((msg_dict.topType === 'chat' && msg_dict.from !== currentStrid) ||
                        (msg_dict.topType === 'consult' && msg_dict.realFrom !== currentStrid))) {
                        if (!msg_dict.history) {
                            unreadTip.show();
                            return;
                        }
                    }
                }

                if (msg_type && msg_type == "10" && msg_dict.sender === 'me') {
                    text = "您发送了一个窗口抖动";
                } else if (msg_type) {
                    //没有这个消息就不需要显示了，因为消息和qtalk客服端一样，所以需要屏蔽掉
                    //不然会显示：当前版本不支持此协议，请升级客户端版本查看
                    // 1100 QchatEnd消息类型

                    if (msg_type == "11" || msg_type === '1003' || msg_type === '1100' || (msg_type == "4000" || msg_type == "4001") && (!extendInfo && text == "当前版本不支持此协议，请升级客户端版本查看")) {
                        continue;
                    };
                    //转接的消息类型
                    if (msg_type == "1001") {
                        extendInfo = text && text.replace(/\s/g, ''); //json字符串
                        isSysMsg = true;
                    }
                }

                //跟据消息类型处理相应业务类的数据:在这里处理
                var extendInfoObj = businessMessage.getMsgHtml(extendInfo, msg_type, isMe);
                var extendInfoHtml = "";
                if (extendInfoObj) {
                    extendInfoHtml = extendInfoObj.info;

                    // 转接后，设置聊天框客服名称
                    if (!msg_dict.history && msg_type === '1001') {
                        self.setChatWindowTitle(true, extendInfoObj.consultName);
                    }
                    text = extendInfoObj.title;
                };

                //如果内容为空值跳过
                // if (!text) {
                //     continue;
                // }

                var msgHtml = "";

                //如果是C2B订单消息信息模板样式不一样
                if (msg_type == "888") {
                    text = "";
                    messageContent = "";
                    //获取C2B显示模板
                    msgHtml = c2bOrderInfo.getMsgHtml(extendInfo, msg_type, true);
                } else {
                    msgHtml = QTMPL.msg.render({
                        'sender': msg_dict.sender == 'me',
                        'time': new Date(msg_time).format1('MM-dd hh:mm:ss'),
                        'username': username,
                        'imageUrl': imageUrl,
                        'message': '',
                        'extra_classes': extra_classes,
                        'webSenderName': chatName || this.chatName,
                        // 'webMyName': myWebName,
                        'webMyName': qChatInstance.setting.isAnonymous?"我":myWebName,//匿名登录时显示 我
                        'webYourName': myWebName,
                        isSysMsg: isSysMsg
                    });
                }
                
                var robotMsg = smartRobot.robotChat.handleRobotMessage(msg_type, extendInfo, {
                    username: myWebName || fullname || username,
                    imageUrl: imageUrl
                });
                msgHtml = robotMsg && robotMsg.html || msgHtml;
                text = robotMsg && robotMsg.text || text;
                
                if (msg_type === 'notify') {
                    var strid = self.converse.settings.get('strid'),
                        shopId = self.converse.settings.get('virtualId');
                    if (text && +msg_dict.category === 99 && (text.isConsult ? shopId : strid) === (text.from || '').split('@')[0]) {
                        msgHtml = notify.render(text);
                    } else {
                        continue;
                    }
                }

                var $msg = $(msgHtml);
                var $msgContent = $msg.find('p').first().text(text);

                if (msg_type && msg_type == "5") {
                    $msgContent.addFileLinks(DOWN_URL);
                } else {
                    handlerTypeSet($msgContent);
                }

                if (!msg_dict.history) {
                    if (!show_time_new || (new Date(msg_time) - new Date(show_time_new)) > show_msg_interval) {
                        var format = "yyyy/MM/dd hh:mm:ss";
                        if (new Date(msg_time).format1("yyyyMMdd") == new Date(show_time_new).format1("yyyyMMdd")) {
                            format = "hh:mm:ss";
                        }

                        appendList.push("<p class='date'><span>" + new Date(msg_time).format1(format) + "</span></p>");
                        show_time_new = new Date(msg_time);
                    }
                    appendList.push($msg.prop('outerHTML'));
                    var $view = $('.m-chat');
                    if ($view.is(':visible')) {
                        //$view.scrollTop($view[0].scrollHeight);
                    }
                    if (LM_REGEXP.test(text) && this.isDujia) {
                        appendList.push(LEAVE_MESSAGE_02);
                    }
                    if (qChatInstance.lmconfig.lm_timing) {
                        clearTimeout(qChatInstance.lmconfig.lm_timing);
                        qChatInstance.lmconfig.lm_timing = '';
                        qChatInstance.lmconfig.timing = 0;
                    }
                } else {
                    if (show_time_old) {
                        if ((new Date(msg_time) - new Date(show_time_old)) > show_msg_interval) {
                            prependList.push("<p class='date'><span>" + new Date(msg_time).format1("yyyy/MM/dd hh:mm:ss") + "</span></p>");
                        }
                    } else {
                        prependList.push("<p class='date'><span>" + new Date(msg_time).format1("yyyy/MM/dd hh:mm:ss") + "</span></p>");
                    }

                    prependList.push($msg.prop('outerHTML'));

                    show_time_old = new Date(msg_time);
                }

            } //end for

            appendList.length && $content.length && $content.append(appendList.join(''));
            prependList.length && $content.length && $content.prepend(prependList.join(''));

            QNR.qevent.fire('refreshScroll');
            //QNR.qevent.fire('showImg');
            if (ifSend) {
                QNR.qevent.fire('reachBottom');
            }

            function handlerTypeSet(ele) {
                var re = /\[obj type=\"(.*?)\" value=\"(.*?)\"( width=(.*?) height=(.*?))?\]/g;
                if (ele.length > 0) {
                    ele.each(function(i, obj) {
                        var text = $(obj).html(),
                            imgDownUrl;
                        text = text.replace(re, function() {
                            if (arguments && arguments.length > 2) {
                                if (arguments[1] === "image") {
                                    //兼容老的
                                    if (arguments[2].indexOf("get_file") > -1) {
                                        imgDownUrl = showImg_url + arguments[2];
                                    } else {
                                        //去掉前缀域名，后端已经加上了
                                        imgDownUrl = arguments[2];
                                    }
                                    return imgDownUrl;
                                } else if (arguments[1] === "emoticon") {
                                    return '<img class="emotions" src="' + QNR.utils.getEmoticonsUrl(arguments[2], DOWN_URL + "/file/v1/emo/d/e/") + '" alt="' + arguments[2] + '"/>';
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
            }

        },
        getInputAndSend: function(text) {
            var self = this,
                $textarea = $("#text"),
                message;
            message = text || $textarea.val();
            if (message !== '') {
                
                // 转换为自定义的 url格式
                message = self.utils.replaceUrl(message); 

                if (self.converse.sendMessage(message)) {
                    self.showMessage([{
                        fullname: self.converse.settings.get("myName"),
                        imageUrl: self.converse.settings.get("myImage"),
                        sender: 'me',
                        time: new Date().toString(),
                        message: message,
                        msgType: "1",
                        myWebName: self.converse.settings.get("myNickName"),
                        chatName: self.converse.settings.get("chatName")
                    }], true);

                    if (sniff.ios) {
                        $textarea.val('');
                    } else {
                        $textarea.val('').focus();
                    }

                    //留言
                    if (!this.lmconfig.leaveMessage) {
                        return;
                    }
                    if (this.lmconfig.lm_timing) {
                        clearTimeout(this.lmconfig.lm_timing);
                        this.lmconfig.lm_timing = '';
                    }

                    leaveMessage();

                    function leaveMessage() {
                        self.lmconfig.lm_timing = setTimeout(leaveMessage, 1000);
                        if (self.lmconfig.timing === 30) {
                            clearTimeout(self.lmconfig.lm_timing);
                            self.lmconfig.lm_timing = '';
                            document.cookie = 'qchat_lm=' + self.strid + new Date().getTime();
                            self.lmconfig.timing = 0;
                            self.lmconfig.leaveMessage = false;
                            $('#msg_list').append(LEAVE_MESSAGE_01);
                            self.getUserInfo(self.showLeaveMessage);
                            //$('#msg_list').append(QTMPL.sendMessage.render({data:{}}));
                            return;
                        }
                        self.lmconfig.timing++;
                    }

                }

            }
        },
        insertEmoticon: function(ev) {
            this.toggleEmoticonMenu();
            var $target = $(ev.target);
            $target = $target.is('img') ? $target : $target.children('img');
            this.sendEmoticon($target);

        },
        sendEmoticon: function(target) {
            if (target) {
                message = target[0].outerHTML;
                if (message) {
                    message = this.utils.replaceUrl(message); //转换为自定义的 url格式
                    if (this.converse.sendMessage(message)) {
                        this.showMessage([{
                            fullname: this.converse.settings.get("myName"),
                            imageUrl: this.converse.settings.get("myImage"),
                            sender: 'me',
                            time: new Date().toString(),
                            message: message,
                            msgType: "1",
                            myWebName: this.converse.settings.get("myNickName"),
                            chatName: this.converse.settings.get("chatName")
                        }], true);

                    }

                }
            }
        },
        switchEmoticon: function(ev) {
            var $target = $(ev.target);
            this.$displayFace.children('ul').hide();
            this.emoticonIndex = $target.data('index');
            this.$displayFace.children('ul:eq(' + this.emoticonIndex + ')').show();
        },
        toggleEmoticonMenu: function() {
            var $em = this.$displayFace;
            $em.slideToggle(0);
            this.loadEmoticons();
            $em.find('ul:eq(' + this.emoticonIndex + ')').show();

            if ($em.is(":visible")) {
                //$(".m-chatops").attr("style","height:270px;");
                $em.siblings().hide();
            } else {
                $(".m-chatops").attr("style", "height:auto;");
            }

        },
        loadEmoticons: function() {
            var emotionContainer = this.$displayFace;
            if (emotionContainer && emotionContainer.children().length < 1) {
                var url = DOWN_URL;
                emotionContainer.append(this.utils.showEmoticons(url));
            }
        },
        clearMessages: function() {
            var result = confirm("确定要清空吗？");
            if (result === true) {
                $('.m-chat').empty();
            }
            return this;
        },
        getQueryString: function(name) {
            var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
            var r = window.location.search.substr(1).match(reg);
            if (r != null) return decodeURIComponent(r[2]);
            return null;
        },

        initQunarApi: function() {
            if (IS_CLIENT) {
                var self = this;

                QunarAPI.ready(function() {

                    QunarAPI.config({
                        debug: IS_DEBUG
                    });

                    QunarAPI.checkJsApi({

                        jsApiList: ['chooseImage', 'uploadImage', 'getDeviceInfo'],
                        success: function(res) {

                            if (res && res.chooseImage && res.uploadImage) {
                                QNR.qevent.fire('QunarAPIInitDone');
                            };

                            if (res.getDeviceInfo) {
                                QunarAPI.hy.getDeviceInfo({
                                    success: function(res) {
                                        if (res && $.isPlainObject(res)) {
                                            var data = [],
                                                index;
                                            for (index in res) {
                                                if (res.hasOwnProperty(index)) {
                                                    data.push(index + "=" + encodeURIComponent(res[index]));
                                                }
                                            }

                                            data.push("u=" + encodeURIComponent(self.myId));
                                            data.push("strid=" + encodeURIComponent(self.myId));
                                            data.push("k=" + encodeURIComponent(self.key));
                                            data.push("url=" + encodeURIComponent(window.location.href));
                                            data.push("cliVer=" + sniff.schema);
                                            data.push("merchant=" + handlerUrl('strid'));

                                            $.ajax({
                                                url: sendwap_url,
                                                type: 'POST',
                                                dataType: 'json',
                                                contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
                                                data: data.join('&'),
                                                success: function(result) {

                                                },
                                                error: function(result) {

                                                }
                                            });
                                        }
                                    }
                                });
                            };
                        },
                        fail: function() { }
                    });
                });
            }

            function handlerUrl(name) {
                var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
                var r = window.location.search.substr(1).match(reg);
                if (r) return decodeURIComponent(r[2]);
                return '';
            }
        },

        initTitle: function() {
            if (IS_CLIENT) {
                QunarAPI.config({
                    debug: IS_DEBUG
                });

                QunarAPI.checkJsApi({

                    jsApiList: ['navRefresh'],
                    success: function(res) {

                        if (res && res.navRefresh) {
                            QunarAPI.hy.navRefresh({
                                title: {
                                    style: 'text',
                                    text: '在线客服'
                                }
                            })
                        }

                    },
                    fail: function() {

                    }
                });
            }
        },

        initScroll: function() {
            var self = this;
            this.historying = false;
            this.$wrapper = $('#wrapper');
            this.$wrapper.find('.chat-list').css('min-height', ($('#wrapper').height() + 1) + 'px');
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
                    self.getHistory();
                }
                setTimeout(function() {
                    self.$operationText[0].blur();
                    if (self.$displayFace.is(":visible")) {
                        self.$displayFace.hide();
                    }
                    if (self.$displayResource.is(":visible")) {
                        self.$displayResource.hide();
                    }
                    //if(self.$operationText.val() === ''){
                    self.$sendMessageHandler.hide();
                    self.$operationResource.show();
                    //}

                }, 0);
            });

            QNR.qevent.on('refreshScroll', function() {
                self.pageScroll.refresh();

            });

            QNR.qevent.on('reachBottom', function() {
                self.pageScroll.scrollTo(0, self.pageScroll.maxScrollY);
            });

            QNR.qevent.on('uploadImgDone', function() {
                $('img[src]').on('load', function() {
                    setTimeout(function() {
                        self.pageScroll.refresh();
                        self.pageScroll.scrollTo(0, self.pageScroll.maxScrollY);
                    }, 50);

                });

                $('img[src]').on('error', function() {
                    setTimeout(function() {
                        self.pageScroll.refresh();
                        self.pageScroll.scrollTo(0, self.pageScroll.maxScrollY);
                    }, 50);

                });

            });


            /*QNR.qevent.on('showImg', function() {

                $('img[src]').on('load', function () {
                    setTimeout(function () {
                        self.pageScroll.refresh();
                    }, 50);

                });

                $('img[src]').on('error', function () {
                    setTimeout(function () {
                        self.pageScroll.refresh();
                    }, 50);

                });

            });*/

            QNR.qevent.on("historyIng", function() {
                setTimeout(function() {
                    self.historying = false;
                }, 300);

            });

            QNR.qevent.on("sendUrl", function(url) {
                if (url) {
                    self.getInputAndSend('售前咨询，详情为: ' + url);
                }
            });

        },
        refreshScroll: function() {
            this.pageScroll.refresh();
        },
        endSession: function() {
            //this.converse.sendMessage(message)
        },

        /*
         * 获取各业务线小众自定义参数 
         * customArgs={} 是一个json字符串参数key->val 
         * 返回:对像
         */
        getObjectByQueryString: function() {
            var vArgs = this.getQueryString("customArgs") || "";

            //customArgs={order_no:C1557079422933291374}

            var result = "";
            if (vArgs.length) {
                result = JSON.parse(vArgs);
            }
            return result;
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
                error: function() {}
            });
        },

        /* 
         * 获取订单信息
         * 1.C2B订单信息显示
         * 2.发送订单消息给后端
         * 3.请求提示语后端接口
         */
        getAddC2bOrderInfo: function(from, to) {

            var self = this;

            //获取连接地址上的参数
            var paramObj = this.getObjectByQueryString();
            var order_no = paramObj.order_no;
            var seatId = this.seatId;
            var shopId = this.getQueryString('shopId');
            var bu_name = this.getQueryString("line");
            var config = null;

            //输入参数
            //订单号
            //当前用户ID myid
            //客服ID strid
            var data = {
                order_no: order_no,
                from: from || "",
                to: to || "",
                line: this.business_name || '',
                seatId: seatId || '',
                virtualId: shopId || ''
            };

            if (order_no) {
                //配置参数
                config = {
                    //回调方法主要用于发送订单、显示提示语信息
                    callback: function(retData) {
                        //sendMsg:发送给后端的订单内容
                        //retData.sendMsg;

                        //发送C2B订单内容消息给后端
                        if (retData.sendMsg) {

                            //发订单消息
                            self.converse.sendOrderMessage(retData.sendMsg, 0);

                            //显示订单信息
                            self.showMessage([{
                                fullname: self.converse.settings.get("myName"),
                                imageUrl: self.converse.settings.get("myImage"),
                                sender: 'me',
                                time: new Date().toString(),
                                message: '888',
                                msgType: "888",
                                extendInfo: retData.sendMsg,
                                myWebName: self.converse.settings.get("myNickName"),
                                chatName: self.converse.settings.get("chatName")
                            }], true);
                        };
                    }
                };
            }

            //调用获取C2B订单消息
            c2bOrderInfo.init(data, config);
        },

        // 获取店铺名称
        getShopName: function(shopId) {
            var self = this,
                u = self.converse.settings.get("myName"),
                k = self.converse.settings.get("key"),
                url = '/newapi/domain/get_vcard_info.qunar?u=' + u + '&k=' + k;
            $.ajax({
                url: url,
                type: 'POST',
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify([{
                    domain: window.nav_igator.baseaddess.domain,
                    users: [{
                        user: shopId,
                        version: '2'
                    }]
                }]),
                success: function(res) {
                    if (res.ret && res.data && res.data[0] && res.data[0].users[0]) {
                        var data = res.data[0].users[0];

                        var name = data.nickname ? data.nickname : data.username;
                        $("#chatName").text(name);
                    }
                }
            })
        },
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
    };

    var qChatInstance = new ChatPage();
    qChatInstance.init();

    function _delay(cb, delay) {
        return setTimeout(cb, delay || 0);
    }
})();