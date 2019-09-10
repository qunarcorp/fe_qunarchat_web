/*
 * @Author: matt.liu
 * @Date:   2016/3/24
 * @Last Modified by:   
 * @Last Modified time: 
 * @Description  在线留言（touch）
 */

;(function() {
    'use strict'
    require("utils/hogan-2.0.0.js");
    require("./leaveMessage.mustache");
    //规则取自淘宝注册登录模块,手机号验证规则
    var phoneOne = {
            //中国移动
            cm: /^(?:0?1)((?:3[56789]|5[0124789]|8[278])\d|34[0-8]|47\d)\d{7}$/,
            //中国联通
            cu: /^(?:0?1)(?:3[012]|4[5]|5[356]|8[356]\d|349)\d{7}$/,
            //中国电信
            ce: /^(?:0?1)(?:33|53|8[079])\d{8}$/,
            //中国大陆
            cn: /^(?:0?1)[3458]\d{9}$/, //中国香港
            //   hk: /^(?:0?[1569])(?:\d{7}|\d{8}|\d{12})$/,
            //澳门
            // macao: /^6\d{7}$/,
            //台湾
            //  tw: /^(?:0?[679])(?:\d{7}|\d{8}|\d{10})$//*,
            //韩国
            //  kr:/^(?:0?[17])(?:\d{9}|\d{8})$/,
            //日本
            // jp:/^(?:0?[789])(?:\d{9}|\d{8})$/*/

            other: /^(?:0?1)7[056789]\d{8}$/
                // 4G 号段和虚拟运营商号段
                // 4G  移动（178） 联通（176），电信（177）
                // 170* 虚拟运营商  移动（1705），联通（1709），电信（1700）
        };

    var leaveMessage = {
        init: function(data, qChat) {
            var me = this;
            me.qChat = qChat;
            me.config = $.extend({
                productId: me.getQueryString('id'),
                supplierId: me.getQueryString('supplierId'),
                type: 1
            }, data);
            if (me.config.sendAuto) {
                me.sendMessage();
                return;
            }
            if ($('#leave_msg').length) {
                me.$w.show();
                $('.m-msg').show();
            } else {
                $('body').append(QTMPL.leaveMessage.render({
                    data: data
                }));
                me.$w = $('#leave_msg');
                me.bindEvents();  
            }
                   
        },

        bindEvents: function() {
            var me = this,
                DOC = $(document);

            DOC.on('blur', '#mobile', function() {
                if ($(this).val() != me.config.mobile) {
                    $('#setCode').show();
                    me.sendCode = true;
                } else {
                    $('#setCode').hide();
                    me.sendCode = false;
                }
                if (!me.checkIsEmpty($(this))){
                    return;
                }
                if (!me.checkIsPhone($(this).val())){
                    $('.err-mobile').html('您输入的手机号有误，请重新输入').css('display', 'block');
                }
            })

            DOC.on('focus', '#mobile', function(){
                $('.err-info').hide();
                
            })

            DOC.on('focus', '#code', function(){
                $('.err-code').hide();
                if (!me.checkIsEmpty($('#mobile'))){
                    return;
                }
            })
            DOC.on('blur', '#code', function(e){
                e.stopPropagation();
                if (!me.checkIsEmpty($(this))){
                    return;
                }
                if (!parseInt($(this).val())) {
                    $('.err-code').html('验证码错误').css('display', 'block');
                }
            })

            DOC.on('click', '#m-msg-close', function(e) {
                e.stopPropagation();
                me.$w.hide();
            });

            DOC.on('click', '.js-code', function(e) {
                e.stopPropagation();
                if (!$('#mobile').val()) {
                    return;
                }
                $('.err-code').hide();
                me.getCode();
            });

            DOC.on('click', '#sendMessage', function(e) {
                if (!me.checkIsEmpty($('#mobile'), $('#shortMessage'))) {
                    //检查必填项是否为空
                    return;
                }
                if (!parseInt($('#code').val()) && me.sendCode) {
                    $('#err-code').html('验证码错误').show();
                    return;
                };
                me.sendMessage();
            })
        },

        //检测输入项
        checkIsEmpty: function(obj) {
            var isOk = true;
            for (var i = 0, len = arguments.length; i < len; i++) {
                if (arguments[i].val() === '') {
                    isOk = false;
                    arguments[i].closest('p').find('.err-info').html('请输入'+ arguments[i].attr('data-info')).css('display', 'block');
                }
            }
            return isOk;
        },

        //获取验证码
        getCode: function() {
            var me = this;
            $.ajax({
                    url: me.config.head + me.config.getCode,
                    type: 'GET',
                    data: {
                        mobile: $('#mobile').val()
                    },
                    dataType: 'jsonp'
                })
                .done(function(result) {
                    if (result.ret) {
                        var second = 60;
                        var $second = me.$w.find('.js_hasCode');
                        me.$w.find('.js_second').text(second);
                        me.$w.find('.js-code').html($second.html());
                        me.timer = setInterval(function() {
                            second--;
                            if (!second) {
                                clearInterval(me.timer);
                                me.$w.find('.js-code').html('发送验证码');
                            }
                            me.$w.find('.js_second').text(second);
                        }, 1000);
                    } else {
                        $('#short_error_message').text(result.msg).show();
                    }

                })
                .fail(function(result) {
                    $('#short_error_message').text('获取验证码失败，请稍后再试！').show();
                })
        },

        sendMessage: function() {
            var me = this;
            $.ajax({
                    url: me.config.head + me.config.sendMessage,
                    type: 'GET',
                    data: {
                        userName: $('#userName').val() || me.config.name,
                        phone: $('#mobile').val() || me.config.mobile,
                        type: me.config.type,
                        enPid: me.config.productId,
                        enSid: me.config.supplierId,
                        code: $('#code').val()
                    },
                    dataType: 'jsonp'
                })
                .done(function(result) {
                    $('.m-msg').hide();
                    if (result.errcode && result.errcode == 1002) {
                        result.msg = '您上次的留言已经发给商家了, 建议您还是耐心等待一下吧。';
                    }
                    if (result.ret) {
                        if (me.config.sendAuto) {
                         $('#msg_list').append('<p class="date m-pb"><span>联系方式发送成功！</span></p>');
                           me.refreshScroll();
                            return; 
                        }
                        
                        $('.m-success').show();
                    } else {
                        if (me.config.sendAuto) {
                            $('#msg_list').append('<p class="date m-pb"><span>'+ result.msg + '</span></p>');
                            me.refreshScroll();
                            return; 
                        }
                        $('.m-fail').find('.m-msg-desc').text(result.msg);
                        if (result.errcode && result.errcode == 1002) {
                            $('.m-fail').find('.m-msg-desc').text('');
                            $('.m-fail').find('.js-error').text(result.msg);
                        }
                        $('.m-fail').show();
                    }

                    
                    setTimeout(function(){
                        me.$w.hide();
                    }, 3000);
                })
                .fail(function(result) {
                    if (result.errcode && result.errcode == 1002) {
                        result.msg = '您上次的留言已经发给商家了, 建议您还是耐心等待一下吧。';
                    }
                    if (me.config.sendAuto) {
                        $('#msg_list').append('<p class="date m-pb"><span>'+ result.msg + '</span></p>');
                        me.refreshScroll();
                        return; 
                    }
                    $('.m-msg').hide();
                    $('.m-fail').find('.m-msg-desc').text(result.msg);
                    if (result.errcode && result.errcode == 1002) {
                        $('.m-fail').find('.m-msg-desc').text('');
                        $('.m-fail').find('.js-error').text(result.msg);
                    }
                    $('.m-fail').show();
                    setTimeout(function(){
                        me.$w.hide();
                    }, 3000);
                })

        },

        refreshScroll: function() {
            var me = this;
            setTimeout(function() {
                me.qChat.pageScroll.refresh();
                me.qChat.pageScroll.scrollTo(0, me.qChat.pageScroll.maxScrollY);
            }, 0);
        },

        //校验手机号
        checkIsPhone: function(data) {
            var ok = false;
            for (var i in phoneOne) {
                if (phoneOne[i].test(data)) {
                    ok = true;
                    break;
                }
            }
            return ok;
        },

        getMobile: function() {
            return $.ajax({
                url: me.config.head + me.config.getMobile,
                data: '',
                type: 'GET',
                dataType: 'jsonp'
            })
        },

        getQueryString: function(name) {
            var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
            var r = window.location.href.substr(1).match(reg);
            if (r != null) return decodeURIComponent(r[2]);
            return null;
        }
    };
    module.exports = leaveMessage;
})()
