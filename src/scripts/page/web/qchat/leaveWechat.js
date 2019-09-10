/*
 * @Author: nengting.jiang
 * @Date:   2017-04-06
 * @Last Modified by:nengting.jiang
 * @Last Modified time:2017-04-06
 * @Description  留下微信号(web)
 */
require('./leaveWechat.mustache');
var sniff = require('../../../lib/sniff/sniff');

var leaveWechat = {
    init: function(data, config) {
        
        this.config = $.extend({
            type: 1,
            sendWechat: '/wechat/userApply.json',
            mobile: data.mobile,
            sendCode: false
        }, config);
        
        if(!this.inited) {
            $('#page-top').append(QTMPL.leaveWechat.render({
                data: data
            }));
            this.$w = $('#js_wechat_message_mask');
            this.$userMessage = $('#js_wechat_info')
            this.$content = $('#js_wechat_msg_content');
            this.$submit_btn = $(".js_submit_wechat_info");
            this.bindEvent();
            this.inited = true;
        } else {
            this.$w.show();
            this.$content.show();
            //this.$content.addClass('message-layer02');
            this.$userMessage.show();
            $('#weixin').val('');
            $("#weixin_error_message").hide();
            this.$submit_btn.addClass("cancel");
        }
    },
    
    bindEvent: function() {
        var me = this,
            DOC = $(document);
        
        DOC.on('input', '#weixin', function(ev) {
            if(!me.checkIsEmpty($(this))) {
                if(!me.$submit_btn.hasClass("cancel")) {
                    me.$submit_btn.addClass("cancel");
                }
                me.$submit_btn.removeClass("refer");
                return;
            } else {
                $("#weixin_error_message").hide();
                
                me.$submit_btn.removeClass("cancel");
                
                if(!me.$submit_btn.hasClass("refer")) {
                    me.$submit_btn.addClass("refer");
                }
                
            }
        });
        
        //关闭窗口
        DOC.on('click', '.js_close_wechat_message', function(e) {
            e.stopPropagation();
            me.$w.hide();
            //me.clearInput();
        });
        
        //提交
        DOC.on('click', '.js_submit_wechat_info', function(e) {
            e.stopPropagation();
            
            if(!me.checkIsEmpty($('#weixin'))) {
                return;
            }
            
            if(me.$submit_btn.hasClass("cancel")) {
                return;
            }
            
            me.submitInfo();
        });
        
    },
    //检测输入项
    checkIsEmpty: function(obj) {
        var isOk = true,
            value = '';
        for(var i = 0, len = arguments.length; i < len; i++) {
            value = arguments[i].val().trim();
            if(!value) {
                isOk = false;
                arguments[i].closest('li').find('.error_tip').text('请输入' + arguments[i].attr('data-info')).show();
            } else if(!/^[\d_\w]+$/i.test(value)) {
                isOk = false;
                arguments[i].closest('li').find('.error_tip').text('请输入正确的' + arguments[i].attr('data-info')).show();
            }
        }
        return isOk;
    },
    
    clearInput: function() {
        var me = this;
        $('#user').val('');
        $('#telephone').val('');
        $('#message').val('');
        $('#shortMessage').val('');
        clearInterval(me.timer);
        me.$w.find('.js_getCode').show();
        me.$w.find('.js_hasCode').hide();
        me.$w.find('.error_tip').hide();
    },
    
    //提交留言
    submitInfo: function() {
        var me = this;
        var platform = navigator.platform;
        // 暂无提供接口
        $.ajax({
            url: '' + me.config.sendWechat,
            type: 'GET',
            data: {
                wechatId: $('#weixin').val(),
                channel: sniff.pc ? (platform.indexOf('Mac') === 0 ? 'PC-Mac' : (platform.indexOf('Win') === 0 ? 'PC-Windows' : 'PC-Linux')) : sniff.os
            },
            dataType: 'jsonp'
        })
            .done(function(result) {
                if(result.ret) {
                    me.$w.hide();
                } else {
                    $('#weixin_error_message').text(result.msg).show();
                }
            })
            .fail(function() {
                $('#weixin_error_message').text('服务器出错，请稍后重试！').show();
            })
    }
};
module.exports = leaveWechat;