/*
 * @Author: heng.xu
 * @Date:   2016/1/18 12:38
* @Last modified by:   dongmei.yang
* @Last modified time: 2017-05-04T14:52:55+08:00
 * @Description  历史浏览记录
 */
require("list.mustache");
require("tabs.mustache");
require("lib/qevent/index.js");

var ONE_DAY = 24*60*60*1000;

var CONST_STR = '-qchatHistory';

var config = {
    tabLength: 5,
    historyIds: '/qcadmin/api/pdt/history.json',// 匿名登录时，需要后台同步数据才能测试
    listInterface: ''// 需使用者自己提供接口,咨询历史接口，与是否登录状态无关，有产品ids就行，beta环境产品ids不存在，所以无数据返回
};

var BrowseHistory = function(){
    this.init();
};

BrowseHistory.prototype = {

    init: function(){
        this.$container = $('.qt-product-history');
        this.initUtil();
        this.initEvent();
    },

    /**
     * 声明工具函数
     */
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
            if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
            for (var k in o)
                if (new RegExp('(' + k + ')').test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
            return fmt;
        };

        if (!Array.prototype.map) {
            Array.prototype.map = function (callback, thisArg) {

                var T, A, k;

                if (this == null) {
                    throw new TypeError(" this is null or not defined");
                }

                // 1. 将O赋值为调用map方法的数组.
                var O = Object(this);

                // 2.将len赋值为数组O的长度.
                var len = O.length >>> 0;

                // 3.如果callback不是函数,则抛出TypeError异常.
                if (Object.prototype.toString.call(callback) != "[object Function]") {
                    throw new TypeError(callback + " is not a function");
                }

                // 4. 如果参数thisArg有值,则将T赋值为thisArg;否则T为undefined.
                if (thisArg) {
                    T = thisArg;
                }

                // 5. 创建新数组A,长度为原数组O长度len
                A = new Array(len);

                // 6. 将k赋值为0
                k = 0;

                // 7. 当 k < len 时,执行循环.
                while (k < len) {

                    var kValue, mappedValue;

                    //遍历O,k为原数组索引
                    if (k in O) {

                        //kValue为索引k对应的值.
                        kValue = O[k];

                        // 执行callback,this指向T,参数有三个.分别是kValue:值,k:索引,O:原数组.
                        mappedValue = callback.call(T, kValue, k, O);

                        // 返回值添加到新数组A中.
                        A[k] = mappedValue;
                    }
                    // k自增1
                    k++;
                }

                // 8. 返回新数组A
                return A;
            };
        }

        if ( !Array.prototype.forEach ) {

            Array.prototype.forEach = function forEach( callback, thisArg ) {

                var T, k;

                if ( this == null ) {
                    throw new TypeError( 'this is null or not defined' );
                }

                var O = Object(this);

                var len = O.length >>> 0;

                if ( typeof callback !== 'function' ) {
                    throw new TypeError( callback + ' is not a function' );
                }

                if ( arguments.length > 1 ) {
                    T = thisArg;
                }

                k = 0;

                while( k < len ) {

                    var kValue;

                    if ( k in O ) {

                        kValue = O[ k ];

                        callback.call( T, kValue, k, O );
                    }
                    k++;
                }
            };
        }

        if (!Array.prototype.some) {
            Array.prototype.some = function(fun /*, thisArg */)
            {
                'use strict';

                if (this === void 0 || this === null)
                    throw new TypeError();

                var t = Object(this);
                var len = t.length >>> 0;
                if (typeof fun !== 'function')
                    throw new TypeError();

                var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
                for (var i = 0; i < len; i++)
                {
                    if (i in t && fun.call(thisArg, t[i], i, t))
                        return true;
                }

                return false;
            };
        }
    },

    /**
     * 没有咨询历史时，更新展示
     */
    noResult: function(){
        this.$container.html('<div class="no-history">您还没有历史记录</div>');
        $('.history-wrapper').css('margin-left', '-.375rem');
    },

    /**
     * 根据产品id获取产品的基本信息
     */
    getProductList: function(supplierId){
        var self = this,
            requestData = [];

        this.productCon.forEach(function(v){
            requestData.push(v.tts_enid + '_1');
        });

        $.ajax({
            url: config.listInterface,
            type: 'GET',
            dataType: 'jsonp',
            jsonp: 'callback',
            data: {
                ids: requestData.join(',')
            },
            success: function(data){
                var results = data && data.data && data.data.list && data.data.list.results;

                if(results && data.ret && results.length > 0){
                    var date = new Date(),
                        today = new Date(date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()).Format('yyyy-MM-dd'),
                        date1 = new Date(today).getTime() - ONE_DAY,
                        yesterday = new Date(date1).Format('yyyy-MM-dd'),
                        resultData = [],
                        datas = [];

                    datas = self.prefixData(results, self.productCon);

                    if(datas && datas.length){
                        datas.forEach(function(v){
                            var showTime,
                                existedItem;

                            if (v.chatDate == today) {
                                showTime = '今天';
                            } else if(v.chatDate == yesterday) {
                                showTime = '昨天';
                            } else {
                                showTime = v.chatDate;
                            }
                            existedItem = self.getSelectedItemByTime(resultData, showTime);
                            if(existedItem) {
                                existedItem.list.push(v);
                            } else {
                                resultData.push({
                                    showTime: showTime,
                                    list: [v]
                                });
                            }
                        });
                    }
                    self.resultData = resultData;
                    self.renderHistoryBySupplierId(supplierId);
                }
            },
            error: function(){
            },
            complete: function(){
            }
        });
    },

    /**
     * 获取咨询历史中的产品ID
     */
    getHistoryProIds: function(supplierId,userQName) {
        var self = this;
        var _q = $.cookie('_q');
        var userQName = userQName || _q && _q.slice(2) || '';
        if(this.resultData && this.resultData.length) {
            this.renderHistoryBySupplierId(supplierId);
            return;
        }
        $.ajax({
            url: config.historyIds,//history.json匿名登录新增参数userQName，获取产品id，再请求getRoutelistByIds获取咨询历史
            type: 'GET',
            dataType: 'jsonp',
            data: {
                userQName: userQName
            },
            success: function(result) {
                if(result && result.ret && result.data && result.data.length) {
                    //有请求结果 - 根据一堆的id请求产品的基本信息
                    self.productCon = result.data;
                    self.getProductList(supplierId);
                } else {
                    //无结果
                    self.noResult();
                }
            },
            error: function() {
                self.noResult();
            }
        });
    },

    /**
     * 渲染咨询历史列表中的产品信息 - 区分本店和外店产品
     */
    renderHistoryBySupplierId: function(supplierId) {
        var resultData = this.resultData,
            i = 0,
            j = 0,
            dateItem,
            listItem,
            listLen = 0,
            length = resultData.length;

        for(; i < length; i++) {
            dateItem = resultData[i];
            listLen = dateItem && dateItem.list && dateItem.list.length;
            for(j = 0; j < listLen; j++) {
                listItem = dateItem.list[j];
                listItem.other = (listItem.supplierId === supplierId ? false : true); //是否是本店
            }
        }
        if(!resultData || !resultData.length) {
            this.noResult();
        } else {
            this.$container.html(QTMPL.list.render({data: resultData}));
        }
    },

    /**
     * 将历史数据的产品id,咨询时间和产品基本信息对应
     */
    prefixData: function(data, ids){
        var item,
            self = this,
            results = [];

        (ids || []).map(function(historyItem) {
            (data || []).map(function(proItem) {
                if(proItem.tuanTtsId === historyItem.tts_enid) {
                    item = self.organizeData(proItem);
                    item.kefu = historyItem.kefu; //咨询历史对应的咨询客服
                    item.chatDate = historyItem.chat_date; //咨询日期
                    results.push(item);
                }
            });
        });
        return results;
    },

    /**
     * 处理要展示的字段
     */
    organizeData: function(data){
        var item, shotTitle,
            imgUrl = this.handleImgUrl(data.thumb),
            title = data.title,
            url = data.url ? data.url.replace(/\?.*/, '') : '';

        if(title.length > 45){
            shotTitle = title.substr(0, 45) + '...';
        }else{
            shotTitle = title;
        }

        item = {
            price: data.price,
            img: imgUrl,
            url: url,
            title: data.title,
            shotTitle: shotTitle,
            id: data.tuanTtsId,
            supplierId: data.summary && data.summary.supplier && data.summary.supplier.supplierEnId
        };
        return item;
    },

    /**
     * 处理图片url
     * @param  {string} img [图片路径]
     */
    handleImgUrl: function(img){
        var protocal = location.protocol;
        if(img){
            if(protocal.indexOf('https:') >= 0){
                img = img.replace(/^(http|https):/, '');
                img = img.replace(/^\/\/[^/]+/, window.nav_igator.baseaddess.fileurl);
            }else if(protocal.indexOf('http:') >= 0){
                img = img.replace(/^(http|https):/, '');
                img = img.replace(/^\/\/[^/]+/, window.nav_igator.baseaddess.fileurl);
            }
            return img;
        }else{
            return '';
        }

    },

    /**
     * 初始化事件监听
     */
    initEvent: function(){

        //发送产品链接点击事件
        this.$container.on('click', '.qt-product-url', function(){
            var url = this.getAttribute('data-url');
            if(url){
                var text = '售前咨询，详情为: ' + url;
                QNR.qevent.fire('sendProUrl', text);
            }
        });

        //咨询客服 - 切换左侧的客服，不用重新分配
        this.$container.on('click', '.qt-product-consult', function() {
            var strid = this.getAttribute('data-strid'),
                $selected;

            if(strid) {
                $selected = $('#' + strid);
                if($selected && $selected.length) {
                    $selected.trigger('click');
                }
            }
        });
    },

    getSelectedItemByTime: function(resultData, showTime) {
        var i = 0,
            existedItem,
            length = resultData && resultData.length || 0;

        for(; i < length; i++) {
            if(!existedItem && resultData[i].showTime === showTime) {
                existedItem = resultData[i];
            }
        }
        return existedItem;
    }
};

module.exports = BrowseHistory;
