/*
 * @Author: heng.xu
 * @Date:   2016/1/9 11:11
 * @Last Modified by:
 * @Last Modified time:
 * @Description    会话列表
 */

require("tmpl/touch/list.mustache");
require("tmpl/touch/item.mustache");
require("../../../../navigation");

var QunarAPI = require("QunarAPI");

var loginDialog=require("./loginDialog.js"),
    isDebug = false,
    config = {
        list: '/api/getlist',
        getVcard: /newapi/muc/get_muc_vcard.qunar,
        domain: window.nav_igator.baseaddess.domain
    },
    ifApp = false;

var Conlist = function(){

    this.$container = $('body');

    this.initUtil();
    this.init();
    this.initIscroll();

}

Conlist.prototype = {

    init: function(){
        var html = QTMPL.list.render({context: ifApp});
        this.$container.append(html);
        this.initList();
        this.initEvent();
    },

    initList: function(){
        var self = this;
        this.list = $('#con-list');
        $.ajax({
            url: config.list,
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
				user: this.myId,
				domain: config.domain
			}),
            success: function(res){
                var data = res;
                if(data && data.length > 0){
                    var param = self.prefixData(data),
                        result = param.result,
                        strids = param.strids,
                        list = QTMPL.item.render({data: result});
                    self.list.append(list);
                    self.pageScroll.refresh();

                    if(strids.length > 0){
                        strids.forEach(function(v, i){
                            var args = [{
                                domain: config.domain,
                                users: [{
                                    user: v,
                                    version: '0'
                                }]
                            }];
                            $.ajax({
                                url: config.getVcard,
                                type: 'POST',
                                dataType: 'json',
                                contentType: 'application/json',
                                data: JSON.stringify(args),
                                success: function(data){
                                    if(data && data.ret && data.data.length > 0){
                                        var item = $('#'+v),
                                            name = $('[data-name="' + v + '"]');
                                        item.find('.item-img').css({'background-image': 'url(' + data.data[0].imageurl + ')'});
                                        name.html(data.data[0].webname);
                                    }
                                },
                                error: function(error){

                                }
                            });

                        });
                    }
                }else{
                    self.list.append('<p class="empty">您暂时没有会话列表</p>');
                }
            },
            error: function(error){
                self.list.append('<p class="empty">您暂时没有会话列表</p>');
            }
        });
    },

    initUtil: function(){
        Date.prototype.Format = function (fmt) {
            var o = {
                "M+": this.getMonth() + 1, //月份
                "d+": this.getDate(), //日
                "h+": this.getHours(), //小时
                "m+": this.getMinutes(), //分
                "s+": this.getSeconds(), //秒
                "q+": Math.floor((this.getMonth() + 3) / 3), //季度
                "S": this.getMilliseconds() //毫秒
            };
            if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
            for (var k in o)
                if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            return fmt;
        }
    },

    prefixData: function(data){
        var result = [], strids = [], currentYear = new Date().getFullYear(), currentDay = new Date().Format('yyyy-MM-dd');

        data.forEach(function(v, i){
            var item = {}, message = '', contact = v.user;
            strids.push(contact);
            if(i == 0){
                strids.push(this.myId);
            }
            message = $(v['xmlbody']);
            // if (v.mFlag == 1) {
            //     me = message.attr('realfrom').split('@')[0]
            // } else {
            //     me = message.attr('realto').split('@')[0]
            // }
            if(message){
                var stime = message.find('stime'),
                    container = stime && stime.attr('stamp'),
                    text = ": " + message.text(),
                    url = "/webchat/touch/?strid=" + contact,
                    type = message.attr('type'),
                    stamp = '',
                    time = '',
                    user = v.user,
                    self = this.myId,
                    isfrom = v.mFlag,
                    owner = '',
                    mark = v.cnt,
                    classParam = '';

                if(isfrom == '1'){
                    owner = self;
                }else{
                    owner = user;
                }

                if(parseInt(mark) > 0){
                    classParam = 'item-number';
                }else{
                    classParam = '';
                    mark = '';
                }

                if(/type="emoticon"/i.test(text) || /type="image"/i.test(text) || type == 'note'){
                    text = ": 您收到一条消息";
                }

                if(container){
                    var day, year, mm;
                    container = new Date(container.substr(0, 4) + '-' + container.substr(4, 2) + '-' + container.substr(6, 2) + container.substr(8));
                    day = container.Format('yyyy-MM-dd');
                    year = container.getFullYear();
                    if(day == currentDay){
                        mm = container.Format('hh:mm');
                        if(parseInt(mm.substr(0, 2)) < 12){
                            stamp = '上午 ' + mm;
                        }else{
                            stamp = '下午 ' + mm;
                        }
                    }else if(year == currentYear){
                        stamp = container.Format('MM-dd');
                    }else{
                        stamp = container.Format('yyyy-MM-dd');
                    }
                    time = container.getTime();
                }

                item = {
                    contact: contact,
                    user: owner,
                    stamp: stamp,
                    text: text,
                    url: url,
                    time: time,
                    classParam: classParam,
                    mark: mark
                }
                result.push(item);
            }
        });
        result.length > 0 && result.sort(function(aa, bb){
            if(aa.time && bb.time){
                return parseInt(bb.time) - parseInt(aa.time);
            }
        });
        return {
            result: result,
            strids: strids
        };
    },

    initIscroll: function(){
        this.pageScroll = new IScroll('#wrapper', {
            probeType: 2,
            mouseWheel: true,
            tap: true,
            click: true,
            momentum: true,
            bounce: true,
            bounceEasing: 'back'
        });
    },

    initEvent: function(){
        this.$back = $('#back');
        this.$back.on('click', function(){
            history.back();
        });
    }

}

loginDialog.init(function(){
    new Conlist();
});

