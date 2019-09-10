/*
 * @Author: baotong.wang 
 * @Date: 2017-04-20 18:57:18 
 * @Last Modified by: baotong.wang
 * @Last Modified time: 2017-04-25 14:36:14
 * @Description: qchat 验证码模块
 *              当消息发送太频繁的时候，需要输入验证码，才能继续发消息
 * @Dependence: jQuery
 */

// 刷新验证码的地址
// 验证逻辑：访问img的同时，即时更新本地的qn25 cookie为img对应的token，
// 发送验证的时候根据token进行服务器端校验 - 来自用户中心
// 需使用者提供接口,验证码接口
var src = '';

var captcha = {
    init: function(checkFunc) {
        this.checkFunc = checkFunc || null;

        this.$dlg = $('#captcha-box');
        this.$mask = $('#global-mask');
        this.$err = $('#errmsg');
        this.$code = this.$dlg.find('input');

        this.bindEvent();
    },
    bindEvent: function() {
        var self = this;
        
        // 更换验证码
        this.$dlg.on('click', 'img', function() {
            this.setAttribute('src', src + '&t=' + new Date().getTime());
        });

        // 提交验证
        this.$dlg.on('click', '.sub-btn', function() {
            var code = self.$code.val();
            self._submit(code);
        });

        this.$code.on('keyup', function(event) {
            if(event.keyCode === 13) {
                self._submit(this.value);
            } else {
                self.$err.toggleClass('hide', this.value.length > 0);
            }
        });
    },
    _submit: function(code) {
        if(!code || code.length !== 4) {
            this.$err.removeClass('hide');
            return;
        }

        this.checkFunc && this.checkFunc(code);
    },
    open: function() {
        this.toggle(false);
    },
    close: function() {
        this.$code.val('');
        this.$err.addClass('hide');
        this.toggle(true);
    },
    toggle: function(status) {
        this.$dlg.toggleClass('hide', status);
        this.$mask.toggleClass('hide', status);
    },
    showError: function() {
        this.$err.removeClass('hide');
    },
    refresh: function() {
        this.$dlg.find('img').attr('src', src + '&t=' + new Date().getTime());
    }
}

module.exports = captcha;