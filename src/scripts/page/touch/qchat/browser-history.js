/*
 * @Author: heng.xu
 * @Date:   2016/1/18 12:38
 * @Last Modified by:
 * @Last Modified time:
 * @Description  历史浏览记录
 */
require("list.mustache");
require("lib/transit/index");
require("lib/qevent/index.js");

// 需使用者自己提供接口
var config = {
    listInterface: "",
    productType: {
        freetrip: '自由行',
        group: '跟团游'
    }
};

var BrowseHistory = function(){

    this.$container = $('#history-container');
    this.$loadTip = $('#history-loading-tip');
    this.$button = $('#history-page');
    this.$mainPage = $('.wrap');
    this.$virtualPage = $('#browser-history');
    this.$mask = $('#filter-mask');
    this.$historyLeft = $('#history-left');
    this.$noResult = $('#history-no-result');

    this.init();
    this.initIscroll();

}

BrowseHistory.prototype = {

    init: function(){
        this.initUtil();
        this.saveProductId();
        this.handleProductId();
        this.initSlider();
        this.initEvent();
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

    saveProductId: function(){
        /*var dateCon = ['2016-12-30', '2016-01-23', '2016-03-04', '2016-01-22', '2016-01-21', '2016-08-09', '2015-12-30', '2017-03-04', '2016-07-09', '2016-07-12'];*/
        if(window.localStorage && window.localStorage.getItem){
            var id = this.getQueryString('id'),
                supplierId = this.getQueryString('supplierId'),
                userName = this.getUserName(),
                tag = userName + '-' + supplierId,
                data = window.localStorage.getItem(tag),
                date = new Date().Format('yyyy-MM-dd'),
                item = {},
                repeat = this.removeRepeat(id, data);

            if(!supplierId || !userName || !id || repeat){
                return;
            }

            if(id && data){
                data = JSON.parse(data);
                var param = data[date];
                if(param){
                    param.push({
                        productID: id
                    })
                }else{
                    data[date] = [];
                    data[date].push({
                        productID: id
                    });
                }
                data = this.removeOldData(data);
                window.localStorage.setItem(tag, JSON.stringify(data));
            }else if(id && !data){
                item[date] = [];
                item[date].push({
                    productID: id
                });
                window.localStorage.setItem(tag, JSON.stringify(item));
            }
        }
    },

    removeRepeat: function(id, data){
        var repeat = false;
        if(id && data){
            data = JSON.parse(data);
            for(var item in data){
                if(data.hasOwnProperty(item)){
                    if(Object.prototype.toString.call(data[item]) == '[object Array]'){
                        data[item].some(function(v, i){
                            if(v.productID == id){
                                repeat = true;
                                return true;
                            }else{
                                return false;
                            }
                        });
                    }
                }
            }
        }
        return repeat;
    },

    removeOldData: function(data){
        var month = 3, item, date = new Date(),
        oldDate = new Date(date.setMonth(date.getMonth() - month)).getTime();
        for(item in data){
            if(data.hasOwnProperty(item)){
                var saveDate = new Date(item).getTime();
                if(saveDate < oldDate){
                    delete data[item];
                }
            }
        }
        return data;
    },

    getProductIds: function(){
        var userName = this.getUserName(), supplierId = this.getQueryString('supplierId'), id=this.getQueryString('id'), data = false, tag = '';
        if(window.localStorage && window.localStorage.getItem && userName && supplierId){
            tag = userName + '-' + supplierId;
            data = window.localStorage.getItem(tag);
            if(data){
                data = JSON.parse(data);
            }else{
                this.noResult();
            }
        }else if(id){
            var date = new Date().Format('yyyy-MM-dd');
            data = {};
            data[date] = [];
            data[date].push({
                productID: id
            });
        }else{
            this.noResult();
        }
        return data;
    },

    noResult: function(){
        //this.$container.append('<div class="no-history">您还没有历史记录</div>');
        //$('.history-wrapper').css('margin-left', '-.375rem');
        this.$noResult.show();
    },

    getUserName: function(){
        var _q = document.cookie && document.cookie.match(/_q=([^;\s]+)/),
            userName = '';
        if(_q && _q.length > 1){
            userName = _q[1];
        }
        return userName;
    },

    getQueryString: function(name) {
        var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
        var r = window.location.search.substr(1).match(reg);
        if (r != null) return decodeURIComponent(r[2]);
        return null;
    },

    initSlider: function(){

        var width = this.$mainPage.width(),
            self = this;
        this.$virtualPage.css({'transform':'translate(' + width + 'px, 0px, 0px)', 'visibility': 'visible'});

        QNR.qevent.on('pageSliderIn', function(){
            self.$mask.show();
            self.$virtualPage.transition({x: 0}, 500, 'linear');
        });

        QNR.qevent.on('pageSliderOut', function(){
            self.$mask.hide();
            self.$virtualPage.transition({x: width}, 500, 'linear');
        });

    },

    getProductList: function(){
        var self = this,
            ids = this.productCon[this.currentIndex],
            requestData = [];
        for(var item in ids){
            if(ids.hasOwnProperty(item) && item != 'length'){
                ids[item].forEach(function(v, i){
                    if(v['productID']){
                        requestData.push(v['productID'] + '_1');
                    }
                });
            }
        }
        //setTimeout(function(){
            $.ajax({
                url: config.listInterface,//getRoutelistByIds，咨询历史接口，与是否登录状态无关，有产品ids就行
                type: 'GET',
                dataType: 'jsonp',
                jsonp: 'callback',
                data: {
                    ids: requestData.join(',')
                },
                success: function(data){
                    if(data && data.ret && data.data && data.data.list && data.data.list.results && data.data.list.results.length > 0){
                        var result = data.data.list.results, list,
                            date = new Date(),
                            today = new Date(date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()).Format('yyyy-MM-dd'),
                            date1 = new Date(today).getTime() - 1000*60*60*24,
                            yesterday = new Date(date1).Format('yyyy-MM-dd'),
                            showTime;

                        result = self.prefixData(result, ids);
                        if(result){
                            for(var item in result){
                                if(result.hasOwnProperty(item)){
                                    if (item == today) {
                                        showTime = "今天";
                                    } else if(item == yesterday) {
                                        showTime = "昨天";
                                    } else {
                                        showTime = item;
                                    }
                                    list = QTMPL.list.render({data: result[item], date: showTime});
                                    document.getElementById('history-loading-tip').insertAdjacentHTML('beforebegin', list);
                                }
                            }
                        }

                    }
                },
                error: function(error){
                    //self.list.append('<p class="empty">您暂时没有会话列表</p>');
                },
                complete: function(){
                    self.currentIndex++;
                    self.renderProduct = false;
                    if(self.currentIndex >= self.maxIndex){
                        self.$loadTip.html('<span class="no-result">没有更多啦</span>').show();
                    }else{
                        self.$loadTip.hide();
                    }
                    self.pageScroll.refresh();
                }
            });
        //}, 2000);

    },

    handleProductId: function(){
        var loadLength = 6, lastItem, self = this, data = this.getProductIds();
        if(data){
            this.productCon = [];
            this.productIds = data;
            this.productIds = this.sortIds();
            for(var item in this.productIds){
                if(this.productIds.hasOwnProperty(item)){
                    lastItem = this.productCon.pop();
                    if(!lastItem){
                        lastItem = {};
                        lastItem[item] = this.productIds[item];
                        lastItem.length = this.productIds[item].length;
                        this.productCon.push(lastItem);
                    }else if(parseInt(lastItem.length) < loadLength){
                        lastItem[item] = this.productIds[item];
                        lastItem.length = parseInt(lastItem.length) + parseInt(this.productIds[item].length);
                        this.productCon.push(lastItem);
                    }else{
                        this.productCon.push(lastItem);
                        lastItem = {};
                        lastItem[item] = this.productIds[item];
                        lastItem.length = this.productIds[item].length;
                        this.productCon.push(lastItem);
                    }
                }
            }
            this.currentIndex = 0;
            this.maxIndex = this.productCon.length;
            this.renderProduct = false;
            if(this.maxIndex <= 0){
                this.noResult();
            }else{
                this.getProductList();
            }
        }

    },

    sortIds: function(){
        var dateArr = [], result = {}, self = this;
        for(var item in this.productIds){
            if(this.productIds.hasOwnProperty(item)){
                dateArr.push(item);
            }
        }
        dateArr.sort(function(aa, bb){
            return parseInt(new Date(bb).getTime()) - parseInt(new Date(aa).getTime());
        });
        dateArr.forEach(function(vv, ii){
            if(vv){
                result[vv] = self.productIds[vv];
            }
        });
        return result;
    },

    scrollCallback: function(){
        this.getProductList();
    },

    prefixData: function(data, ids){
        var result = {}, self = this;
        if(data.length > 0){
            for(var item in ids){
                if(ids.hasOwnProperty(item) && item != 'length' && Object.prototype.toString.call(ids[item]) == "[object Array]"){
                    result[item] = [];
                    ids[item].forEach(function(vv, ii){
                        if(vv.productID && vv.ext){
                            data.some(function(vvv, iii){
                                var arr = [], choose = true;
                                if(vvv.tuanTtsId == vv.productID){
                                    for(var vvvv in vv.ext){
                                        if(vv.ext[vvvv] == vvv[vvvv]){
                                            arr.push(true);
                                        }else{
                                            arr.push(false);
                                        }
                                    }
                                }
                                if(arr.length > 0){
                                    arr.forEach(function(vvvvv, iiiii){
                                        if(!vvvvv){
                                            choose = false;
                                        }
                                    });
                                }else{
                                    choose = false;
                                }
                                if(choose){
                                    result[item].push(self.organizeData(vvv));
                                    return true;
                                }else{
                                    return false;
                                }
                            });
                        }else if(vv.productID && !vv.ext){
                            data.some(function(vvv, iii){
                                if(vvv.tuanTtsId == vv.productID){
                                    result[item].push(self.organizeData(vvv));
                                    return true;
                                }else{
                                    return false;
                                }
                            });
                        }
                    });
                }
            }
            return result;
        }else{
            return false;
        }
    },

    organizeData: function(data){
        var tag = "", item, imgUrl;
        if(data.details && data.details.traffic){
            tag += data.details.traffic;
        }
        if(data.details && data.details.star){
            if(tag){
                tag += (' | ' + data.details.star + '星酒店');
            }else{
                tag += (data.details.star + '星酒店');
            }
        }
        imgUrl = this.handleImgUrl(data.thumb);
        item = {
            type: config.productType[data.type],
            price: data.price,
            tag: tag,
            img: imgUrl,
            // url: '' + data.tuanTtsId,
            title: data.title,
            id: data.tuanTtsId
        };
        return item;
    },

    handleImgUrl: function(img){
        var protocal = location.protocol;
        if(img){
            if(protocal.indexOf('https:') >= 0){
                img = img.replace(/^(http|https):/, '');
                img = img.replace(/^\/\/[^/]+/, window.nav_igator.baseaddess.fileurl + '/');
            }else if(protocal.indexOf('http:') >= 0){
                img = img.replace(/^(http|https):/, '');
                img = img.replace(/^\/\/[^/]+/, window.nav_igator.baseaddess.fileurl + '/');
            }
            return img;
        }else{
            return "";
        }

    },

    initIscroll: function(){
        var self = this;

        this.pageScroll = new IScroll('.history-wrapper', {
            probeType: 2,
            mouseWheel: true,
            tap: true,
            click: true,
            momentum: true,
            bounce: true,
            bounceEasing: 'back'
        });

        this.pageScroll.on("scroll", function(){
            if(this.y < (this.maxScrollY-10) && !self.renderProduct && self.currentIndex < self.maxIndex){
                self.renderProduct = true;
                self.$loadTip.show();
                self.pageScroll.refresh();
                self.pageScroll.scrollTo(0, self.pageScroll.maxScrollY);
                self.scrollCallback();
            }
        });

    },

    initEvent: function(){
        var self = this;

        this.$container.on('click', '.product-button', function(e){
            e.preventDefault();
            var url = this.getAttribute('data-url');
            QNR.qevent.fire('pageSliderOut');
            QNR.qevent.fire('sendUrl', url);
        });

        this.$button.on('click', function(){
            QNR.qevent.fire('pageSliderIn');
        });

        this.$historyLeft.on('click', function(){
            QNR.qevent.fire('pageSliderOut');
        });

    }

}


module.exports = BrowseHistory;

