/*
 * @Author: matt.liu
 * @Date:   2016/3/23 
 * @Last Modified by:
 * @Last Modified time:
 * @Description  用户留言(web)
 */
require('./leaveMessage.mustache');
//规则取自淘宝注册登录模块,手机号验证规则
var phoneOne = {
        //中国移动
        cm: /^(?:0?1)((?:3[56789]|5[0124789]|8[278])\d|34[0-8]|47\d)\d{7}$/,
        //中国联通
        cu: /^(?:0?1)(?:3[012]|4[5]|5[356]|8[356]\d|349)\d{7}$/,
        //中国电信
        ce: /^(?:0?1)(?:33|53|8[079])\d{8}$/,
        //中国大陆
        cn: /^(?:0?1)[3458]\d{9}$/,    //中国香港
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
	init: function(data,config) {

        this.config = $.extend({
            type: 1,
            mobile: data.mobile,
            sendCode: false     
        }, config);
        
		if (!this.inited) {
			$('#page-top').append(QTMPL.leaveMessage.render({data:data}));
			this.$w = $('#js_message_mask');
			this.$messageEdit = $('#js_message_edit');
			this.$userMessage = $('#js_info')
			this.$successEdit = $('#js_message_success');
			this.$failEdit = $('#js_message_fail');
            this.$messgaeSizeDOM = $('#js_message_len');
            this.$content = $('#js_msg_content');
            this.$leaveMessage = $('#leave_message');
            $('.js_message_info').hide();
			this.bindEvent();
            this.inited = true;
		} else {
            // $('#js_message_mask').remove();
            // $('#page-top').append(QTMPL.leaveMessage.render({data:data}));
            this.$w.show();
            this.$content.show();
            this.$successEdit.hide();
            this.$failEdit.hide();
            //this.$messageEdit.show();
            this.$content.addClass('message-layer02');
            this.$userMessage.show();
            this.$leaveMessage.val('');
        }
	},

	bindEvent: function() {
        var me = this,
        	DOC = $(document);
        //用户留言提示信息相关
        DOC.on('mouseover', '.js_leave_message', function(){
            $('.js_message_info').show();
        });

        DOC.on('mouseout', '.js_leave_message', function(){
            $('.js_message_info').hide();
        });

        //弹窗
        DOC.on('click', '.js_leave_message', function(){
            me.$w.show();
            me.$successEdit.hide();
            me.$failEdit.hide();
            me.$messageEdit.show();
            me.$messgaeSizeDOM.text(0);
        });

        DOC.on('click', '.js_edit_message', function(){
            $('#js_msg_content').removeClass('message-layer02');
        	me.$userMessage.hide();
        	me.$messageEdit.show();
        });

        DOC.on('focus', '#telephone', function(ev) {
        	$(this).closest('li').find('.error_tip').hide();
        });

        DOC.on('focus', '#shortMessage', function(ev) {
        	$(this).closest('li').find('.error_tip').hide();
        });

        DOC.on('blur', '#telephone', function(ev) {
        	var value = $(this).val();
            if ($(this).val != me.config.mobile) {
                $('#code').show();
                me.config.sendCode = true;
            } else {
                $('#code').hide();
                me.config.sendCode = true;
            }
        	if (me.checkIsEmpty($(this))) {
        		if (!me.checkIsPhone(value)) {
        			$(this).closest('li').find('.error_tip').text('手机号格式不正确').show();
        		}
        	};
        });

        DOC.on('blur', '#shortMessage', function(ev) {
            var value = $(this).val();
            if (!me.checkIsEmpty($(this))) {
                return;
            }
            if (!Number($(this).val())) {
                $(this).closest('li').find('.error_tip').text('验证码错误').show();
            };
        });
        
        // 计数器
        DOC.on('keyup', '#message', function(ev) {
            var value = $(this).val() , len ;
            if ( value.length > me.config.maxlength ) {
                value = value.substr(0 , 300 ) ;
                len = me.config.maxlength ;
            }else{
                len = value.length ;    
            }
            me.$messgaeSizeDOM.text( len ) ;
        });
        
        DOC.on('click', '.js_getCode', function(e) {
            e.stopPropagation();
            if (!me.checkIsEmpty($('#telephone'))) {
                return;
            }
            $('#short_error_message').hide();
            me.getCode();
        });

        DOC.on('click', '.js_close_message', function(e){
            e.stopPropagation();
            me.$w.hide();
            //me.clearInput();
        });

        DOC.on('click', '.js_submit_message', function(e){
            e.stopPropagation();
        	var telephone = $('#telephone').val(),
        		shortMessage = $('#shortMessage').val();
        	if (!me.checkIsEmpty($('#telephone'))) {
        		//检查必填项是否为空
        		return;
        	}
            if (me.config.sendCode && !me.checkIsEmpty($('#shortMessage'))) {
                return;
            }
            if (me.config.sendCode && !Number($('#shortMessage').val())) {
                $('#short_error_message').text('验证码错误').show();
                return;
            };
            me.submitInfo();
        });
        DOC.on('click', '.js_submit_Info', function(e){
            e.stopPropagation();
            me.submitInfo();
        });

    },
    //检测输入项
    checkIsEmpty: function(obj) {
    	var isOk = true;
    	for (var i = 0, len = arguments.length; i < len; i++) {
    		if (arguments[i].val() === '') {
    			isOk = false;
    			arguments[i].closest('li').find('.error_tip').text('请输入'+ arguments[i].attr('data-info')).show();
    		}
    	}
    	return isOk;
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

    //获取验证码
    getCode: function() {
        var me = this;
        $.ajax({
                url: me.config.head + me.config.getCode,
                type: 'GET',
                data: {
                    mobile: $('#telephone').val()
                },
                dataType: 'jsonp'
            })
            .done(function(result){
                if (result.ret) {
                    var second = 60;
                    me.$w.find('.js_second').text(second);
                    me.$w.find('.js_getCode').hide();
                    me.$w.find('.js_hasCode').show();
                    me.timer = setInterval(function(){
                        second --;
                        if (!second) {
                            clearInterval(me.timer);
                            me.$w.find('.js_getCode').show();
                            me.$w.find('.js_hasCode').hide();
                        } 
                        me.$w.find('.js_second').text(second);
                    }, 1000);
                } else {
                    $('#short_error_message').text(result.msg).show();
                }

            })
            .fail(function(result){
                $('#short_error_message').text('获取验证码失败，请稍后再试！').show();
            })
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
        //留言
        var leaveword = $('#js-leaveword').val() || "";

    	$.ajax({
                url: me.config.head + me.config.sendMessage,
                type: 'GET',
                data: {
                    userName: $('#user').val(),
                    phone: $('#telephone').val(),
                    productTitle: me.config.productTitle,
                    code: $('#shortMessage').val(),
                    enPid: me.config.enPid,
                    enSid: me.config.enSid,
                    leaveword:leaveword,
                    message: me.$leaveMessage.val()
                },
                dataType: 'jsonp'
        	})
            .done(function(result){
                if (result.ret) {
                    me.$content.hide();
                    me.$successEdit.show();
                    //me.clearInput();
                } else if(result.errcode == 1005 || result.errcode == 1006){
                    $('#short_error_message').text('验证码错误').show();
                } else {
                    me.$content.hide();
                    $('#js_errorMessage').text(result.msg);
                    me.$failEdit.show();
                    //me.clearInput();
                }
            })
            .fail(function(){
                me.$content.hide();
                $('#js_errorMessage').text('服务器出错，请稍后重试！');
                me.$failEdit.show();
            })
    }
};
//leaveMessage.init();


module.exports = leaveMessage;
 