/* 
 * @Author: haoliang.yan
 * @Date:   2015-01-15 18:17:58
 * @Last Modified by:   dongmei.yang
 * @Last Modified time: 2015-12-14 10:57:00
 * @Version 0.0.1 增加全局设置方法
 * @Description 弹窗
 */

/**
 * @Param options param
 *  如果参数类型为字符串，则被转换为 
 *       {
 *           cancel: true,
 *           cancel_text: '确定',
 *           data: {
 *               title: '消息',
 *               text: options
 *           }
 *       }
 * @Option id String  弹窗DOM ID
 * @Option data Object 结构为 {title: '', 'text'}，如果是列表数据，就传入列表
 * @Option close Boolean 是否显示右上角关闭按钮
 * @Option ok Boolean 是否显示确认按钮
 * @Option cancel Boolean 是否显示取消按钮
 * @Option ok_text String 确认按钮文本
 * @Option cancel_text String 取消按钮文本
 * @Option onok Function 确认按钮点击回调
 * @Option oncancel Function 取消按钮点击回调
 * @Option context Object 执行上下文
 * @Option closeOnMask Boolean 点击mask区域时是否关闭弹窗
 * @Option btn_class String 加在按钮上的class名称
 */
(function($, QNR) {
    'use strict';
    require('./alertify.mustache');
    var styleStr = require('./alertifycss.string');

    var defaults = {
        id: 'j_pop_frame',
        multi: function() {
            return $.isArray(this.data);
        },
        data: { // 如果需要显示多条内容，传入list
            title: '', // 主标题，居中显示
            text: '' // 弹窗内容
        },
        close: false, // 是否包含关闭按钮
        ok: false, // 是否显示OK按钮
        cancel: false, // 是否显示 Cancel 按钮
        ok_text: '确定',
        cancel_text: '取消',
        onok: null, // 确定回调
        oncancel: null, // 取消回调
        onclose: null, // 关闭回调
        context: null,
        btn_class: '',
        closeOnMask: true // 点击mask区域时是否触发 close
    };

    var global = {};

    function Alertify(options) {
        this.$body = null;
        if (typeof options === 'string') {
            this.config = $.extend({}, defaults, global, {
                cancel: true,
                cancel_text: '确定',
                data: {
                    title: '消息',
                    text: options
                }
            });
        } else {
            this.config = $.extend({}, defaults, options);
        }
        this.build();
        this.init();
    }

    Alertify.prototype = {
        build: function(args) {
            // 如果已经存在指定ID的元素，则移除
            $('#' + this.config.id).remove();
            this.$body = $(QTMPL.alertify.render(this.config)).appendTo('body');

            this.adapt();
        },
        adapt: function() {
            if (this.$body.find('.b_fh_pop').height() > $(window).height()) {
                this.$body.addClass('fh_flex_top');
            } else {
                this.$body.removeClass('fh_flex_top');
            }
        },
        asyncClose: function() {
            var self = this;
            setTimeout(function() {
                self.$body.hide();
            });

            this.config.onclose && this.config.onclose();

            this.destroy();
        },
        init: function() {
            var self = this;
            this.$body.on('click', '.close', function(e) {
                e.preventDefault();
                self.asyncClose();
                return false;
            }).on('click', '.buy', function() {
                if (self.config.onok && (self.config.onok.apply(self.config.context) === false)) {
                    return;
                }
                self.asyncClose();
            }).on('click', '.nobuy', function() {
                if (self.config.oncancel && (self.config.oncancel.apply(self.config.context) === false)) {
                    return false;
                }
                self.asyncClose();
                return false;
            }).on('touchmove', '.v_pop', function(e) {
                e.stopPropagation();
                if ($(e.target).closest('.b_fh_pop').length === 0) {
                    e.preventDefault();
                    return false;
                }
            });

            if (this.config.closeOnMask) {
                this.$body.on('click', '.v_pop', function(e) {
                    if ($(e.target).closest('.b_fh_pop').length === 0) {
                        self.asyncClose();
                    }
                });
            }

            this.fnAdapt = this.adapt.bind(this);

            window.addEventListener('onorientationchange' in window ? 'orientationchange' : 'resize', this.fnAdapt, false);
        },
        destroy: function() {
            this.$body.remove();
            window.removeEventListener('onorientationchange' in window ? 'orientationchange' : 'resize', this.fnAdapt);
        }
    };

    var style = document.createElement('style');
    style.innerHTML = styleStr;
    document.head.appendChild(style);

    QNR.alertify = function(options) {
        if (Alertify.instance) {
            Alertify.instance.destroy();
        }
        Alertify.instance = new Alertify(options);
        return Alertify.instance;
    };

    QNR.alertify.config = function(options) {
        global = options || {};
    }

})(jQuery, window.QNR || (window.QNR = {}));