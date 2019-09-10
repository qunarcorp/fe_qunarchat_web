/*
 * @Author: nengting.jiang
 * @Date:  2017-05-08
 * @Last Modified by:   wanghaowh.wang
 * @Last Modified time: 2017-06-22 15:02:27
 * @Description PC,touch端共用 
 *          C2B项目订单：
 *				 1.获取 C2B订单信息 发给客服端
 *              
 */

//订单touch显示模板
require("tmpl/touch/orderDetailTouch.mustache");
//订单PC显示模板
require("tmpl/web/orderDetail.mustache");

var sayHello = require('./helloMsg');


//C2B订单信息接口
//欢迎语接口
var URL = {
	baseInfo: '' // 暂无提供接口
};

//C2B订单
var c2bOrderInfo = {

	init: function(data, config) {
		// order_no: order_no,
		// from: from,
		// to: to
		var self = this;
		this.config = $.extend({
			order_no: data.order_no,
			from: data.from,
			to: data.to,
			line: data.line,
			seatId: data.seatId,
			virtualId: data.virtualId,
			seatHost: data.seatHost
		}, config);

		if (data.order_no) {
			this.get();
		}

		setTimeout(function() {
			//请求后端发提示语消息
			sayHello(data);
		}, 500);
	},

	get: function() {
		var self = this;
		$.ajax({
			url: URL.baseInfo,
			type: 'GET',
			dataType: 'jsonp',
			data: {
				order_no: self.config.order_no
			},
			jsonp: 'callback',
			success: function(data) {
				if (data.ret && data.data) {
					//渲染显示订单信息
					self.renderOrderInfo(data.data);
				}
			},
			error: function() {}
		});
	},

	/*
	 * 渲染订单信息
	 */
	renderOrderInfo: function(data) {
		var self = this;

		if (data.length == 0) {
			return;
		}

		//处理数据
		var dataFix = this.prefixOrderData(data);

		//订单信息发送给后端
		var sendMsgContent = this.getOrderJSON(dataFix);

		//sendMsg:发送给后端的订单内容
		var retData = {
			sendMsg: sendMsgContent
		};

		//回调函数显示订单信息
		this.config.callback && this.config.callback(retData);

	},

	/*
	 * 请求后端提示语接口,后端会发一条提语消息给前端
	 */
	requestSayHello: function() {
		var self = this;
		$.ajax({
			url: URL.sayHello,
			type: 'POST',
			dataType: 'jsonp',
			data: {
				seatQName: self.config.from,
				userQName: self.config.to,
				line: self.config.line,
				seatId: self.config.seatId,
				virtualId: self.config.virtualId,
				seatHost: self.config.seatHost || window.nav_igator.baseaddess.domain
			},
			jsonp: 'callback',
			success: function(data) {},
			error: function() {}
		});
	},

	//处理返回的订单数据
	prefixOrderData: function(data) {

		// 用户名=contact_user
		// 用户手机号=contact_mobile
		// 订单号=order_no
		// 目的地=destination_name
		// 出行天数=days
		// 出行人数=person_number
		// 出发日期=trip_date 数组 
		// 人均预算=budget 数组

		var trip_date = "";
		var budget = "";
		var detail_url = "" + data.order_id; // 暂无提供接口

		//出发日期
		if (data.trip_date.length) {

			if (data.trip_date.length > 1) {
				//如果相等
				if (data.trip_date[0] == data.trip_date[1]) {
					trip_date = data.trip_date[0];
				} else {
					trip_date = data.trip_date[0] + " 至 " + data.trip_date[1];
				}
			} else {
				trip_date = data.trip_date[0];
			}
		}

		//人均预算
		if (data.budget.length) {
			if (data.budget.length > 1) {
				//如果相等
				if (data.budget[0] == data.budget[1]) {
					budget = "￥" + data.budget[0];
				} else {
					budget = "￥" + data.budget[0] + "~" + "￥" + data.budget[1];
				}
			} else {
				budget = data.budget[0];
			}
		}

		var result = {
			contact_user: data.contact_user,
			contact_mobile: data.contact_mobile,
			order_no: data.order_no,
			destination_name: data.destination_name.join("、"),
			days: data.days,
			person_number: data.person_number,
			trip_date: trip_date,
			budget: budget,
			detail_url: detail_url
		};

		return result;
	},

	//获取订单JSON数据
	getOrderJSON: function(data) {

		// "titleimg": "",     ------ 头图url（可没有）
		// "titletxt": "",     ------ 产品名称
		// "productimg": "",   ------ 产品图（可以没有）
		// "detailurl": "",    ------ 点击卡片希望跳转到的页面地址
		// "descs": [{
		//     "k": "",        ------ 文字描述左侧
		//     "v": ""         ------ 文字描述右侧
		//         "c": ""         ------ v 部分的字颜色
		// }],
		// "descdetail":""     ------ 一句话描述，将所有的元素拼成一个字符串，空行用多个回车表示（windows客户端专用）

		var contact_user = data.contact_user;
		var contact_mobile = data.contact_mobile;
		var order_no = data.order_no;
		var destination_name = data.destination_name;
		var days = "共" + data.days + "天";
		var person_number = data.person_number + "人";
		var trip_date = data.trip_date;
		var budget = data.budget + "/人";
		var detail_url = data.detail_url;

		var descdetail = []; //windows客户端专用         
		var descs = [];
		var userInfo = contact_user + "(" + contact_mobile + ")";

		descdetail.push("用户信息:");
		descdetail.push(userInfo);
		descdetail.push("\n\n");

		descdetail.push("订单号:");
		descdetail.push(order_no);
		descdetail.push("\n\n");

		descdetail.push("目的地:");
		descdetail.push(destination_name);
		descdetail.push("\n\n");

		descdetail.push("出发日期:");
		descdetail.push(trip_date);
		descdetail.push("\n\n");

		descdetail.push("行程天数:");
		descdetail.push(days);
		descdetail.push("\n\n");

		descdetail.push("出行人数:");
		descdetail.push(person_number);
		descdetail.push("\n\n");

		descdetail.push("人均预算:");
		descdetail.push(budget);


		descs.push({
			"k": "用户信息",
			"v": userInfo
		});

		descs.push({
			"k": "目的地",
			"v": destination_name
		}, {
			"k": "出发日期",
			"v": trip_date
		}, {
			"k": "行程天数",
			"v": days
		}, {
			"k": "出行人数",
			"v": person_number
		}, {
			"k": "人均预算",
			"v": budget
		});

		//openstyle APP端用
		//值是1，就表示是在frame框中打开url, 如果是0 就表示在系统的浏览器中打开，这个值默认是0
		var t = {
			"titleimg": "",
			"titletxt": "我的定制游订单（" + order_no + "）",
			"productimg": "",
			"openstyle": 0,
			"detailurl": detail_url,
			"descs": descs,
			"descdetail": descdetail.join("")
		};

		return t;
	},

	/*
	 * 获取业务线扩展的消息内容
	 * data 
	 * msgType
	 * isTouch
	 */
	getMsgHtml: function(data, msgType, isTouch) {
		var result = "";
		msgType = parseInt(msgType, 10);
		switch (msgType) {
			//C2B订单消息
			case 888:
				result = this.getOrderInfo(data, isTouch);
				break;
		}
		return result;
	},

	/*
	 * 获取C2B订单消息
	 * data
	 * isTouch 
	 */
	getOrderInfo: function(data, isTouch) {

		if (!data) {
			return "";
		}

		if (typeof data === 'string') {
			data = JSON.parse(data);
		};

		//console.log("c2border ==========", data);

		var resultMsgContent = "";

		//Touch订单模板
		if (isTouch) {
			resultMsgContent = QTMPL.orderDetailTouch.render({
				data: data
			});
		} else {
			//PC订单模板
			resultMsgContent = QTMPL.orderDetail.render({
				data: data
			});
		}

		return resultMsgContent;
	}
};

module.exports = c2bOrderInfo;