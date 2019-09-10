/**
 * @Author: root
 * @Date:   2018-04-09T16:04:51+08:00
 * @Filename: index.js
 * @Last modified by:   root
 * @Last modified time: 2018-04-09T16:04:52+08:00
 * @Description: 任务众包
 */

require('./notify.mustache');

var utils = require('utils/utils');

var bound = false;
var notify = {
    bindEvent: function() {
        if (bound) {
            return;
        }
        bound = true;
        $('body').on('click', '.js-notify', function() {
            var $this = $(this),
                uri = $this.data('uri');
            
            if (uri.indexOf('http:') > -1) {
                uri = uri.replace('http:', 'https:');
            }
                
            if (uri) {
                $.ajax({
                    url: uri,
                    type: 'GET',
                    dataType: 'jsonp',
                    success: function(res) {
                        if (res.ret && res.data) {
                            var data = res.data;
                            // 暂无提供接口
                            var url = '' + (data.realTo || data.to || '').split('@')[0];
                            url += data.is_consult ? '&shopId=' + data.shop_id : '';
                            
                            location.href = url;
                        }
                    }
                });
            }
        }).on('click', '.js-notify-close', function() {
            $(this).closest('.notify').addClass('hide');
        });
    },
    render: function(data) {
        this.bindEvent();
        if (data && data.noticeStr) {
            return QTMPL.notify.render({data: data});
        } else {
            return '';
        }
    }
};

module.exports = notify;