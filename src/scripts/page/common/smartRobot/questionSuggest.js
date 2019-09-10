/**
 * @Author: wanghaowh.wang
 * @Date:   2017-11-02T10:58:50+08:00
 * @Filename: index.js
 * @Last modified by:   wanghaowh.wang
 * @Last modified time: 2017-11-02T10:59:39+08:00
 * @Description: 智能客服在输入时会有个问题列表suggest
 */



'use strict';

require('./questionSuggest.mustache');

var questionSuggest = {
    init: function(config) {
        var self = this;
        
        self.timer = null;
        self.isShowingSuggest = false;
        self.hasBoundEvents = false;
        
        if (!self.$suggestWrapper) {
            self.$suggestWrapper = $('<div id="js-questionSuggest"></div>');
            document.body.appendChild(self.$suggestWrapper[0]);
            
            self.config = {
                startRobot: true,
                bsid: '',   // 店铺id
                bu: 'dujia',    // 业务线id
                pid: '' // 当前咨询产品id
            };
        }
            
        $.extend(self.config, config || {});
        
        if (!self.config.startRobot) {
            return;
        }
        
        self._bindEvents();
    },
    closeSuggest: function() {
        this.config.startRobot = false;
    },
    startSuggest: function(input, callback) {
        var self = this;
        clearTimeout(self.timer);
        self.timer = setTimeout(function() {
            self._show(input, function(res) {
                self.timer = null;
                callback && callback(res);
            });
        }, 700);
    },
    _bindEvents: function() {
        var self = this;
        
        if (self.hasBoundEvents) {
            return;
        }
        $(document).on('click', function() {
            self._hide();
        });
    },
    _hide: function() {
        if (this.$suggestWrapper.hasClass('hide')) {
            return;
        }
        this.$suggestWrapper.addClass('hide');
    },
    _show: function(input, callback) {
        var self = this;
        if (!self.config.startRobot) {
            return;
        }
        // 暂无提供接口
        $.ajax({
            url: '',
            type: 'GET',
            dataType: 'json',
            crossDomain: true,
            xhrFields: {
                withCredentials: true
            },
            data: {
                m: 's',
                bsid: self.config.bsid,
                pid: self.config.pid,
                bu: self.config.bu,
                question: input
            }
        }).done(function(res) {
            if (res.ret && res.data && res.data.length) {
                self.$suggestWrapper.html(QTMPL.questionSuggest.render(res)).removeClass('hide');
                callback && callback(res);
            } else {
                self.$suggestWrapper.addClass('hide');
            }
        });
    }
};

module.exports = questionSuggest;