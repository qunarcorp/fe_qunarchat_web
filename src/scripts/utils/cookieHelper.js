var config = {
	domain: ';domain=' + window.nav_igator.baseaddess.domainhost,
	path: ';path=/',
	// cookie设置的单位是秒，这里以天为单位
	maxAge: 7
}
var cookieHelper = {
	cookie: null,
	setCookie: function(name, value, dayToLive) {
		var cookie = name + '=' + encodeURIComponent(value);
		cookie += config.domain + config.path;
		cookie += ';max-age=' + (dayToLive || config.maxAge) * 24 * 60 * 60;

		document.cookie = cookie;
	},
	getCookie: function(name) {
		var all = document.cookie;
		if(all === '') {
			return
		}

		var cookies = {};
		var list = all.split(';');

		for(var i = 0; i < list.length; i++) {
			var keyPair = list[i].split('=');
			cookies[keyPair[0].trim()] = decodeURIComponent(keyPair[1].trim());
		}

		if(cookies) {
			return cookies[name] || null;
		}

		return null;
	},
	removeCookie: function(name) {
		var all = document.cookie;
		if(all === '') {
			return
		}

		var cookies = {};
		var list = all.split(';');

		for(var i = 0; i < list.length; i++) {
			var keyPair = list[i].split('=');
			cookies[keyPair[0].trim()] = decodeURIComponent(keyPair[1].trim());
		}

		if(cookies[name]) {
			var exp = new Date();
			exp.setTime(exp.getTime() + (-1 * 24 * 60 * 60 * 1000));

			var cookie = name +'=' + cookies[name] + config.domain + config.path + ';expires=' + exp.toGMTString();
			document.cookie = cookie;
		}
	}
}

module.exports = cookieHelper;