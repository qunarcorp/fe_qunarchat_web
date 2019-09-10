/*
* @Author: wanghaowh.wang
* @Date:   2017-12-26 09:56:57
* @Last Modified by:   wanghaowh.wang
* @Last Modified time: 2017-12-27 11:28:02
*/
var sniff = require('lib/sniff/sniff');
var styleSheet = require('./style.css');

function UnreadTip() {
    var fragment = document.createDocumentFragment(),
            style = document.createElement('style'),
            a = document.createElement('a'),
            closeSpan = document.createElement('span'),
            conlistUrl = '/webchat/conlist/';
            self = this;

    a.href = sniff.schema ? sniff.schema + '://hy?url=' + encodeURIComponent(conlistUrl) : conlistUrl;
    a.innerHTML = '您有未读消息，点击<strong>查看</strong>';

    closeSpan.className = 'close';
    closeSpan.innerText = 'X';
    closeSpan.addEventListener('click', self.hide.bind(self));

    self.div = document.createElement('div');
    self.div.className = 'unread-tip hide';
    self.div.appendChild(a);
    self.div.appendChild(closeSpan);

    style.innerText = styleSheet;

    fragment.appendChild(self.div);
    fragment.appendChild(style);

    if (sniff.schema) {
        document.body.classList.add('app');
    }

    document.body.appendChild(fragment);
}

UnreadTip.prototype.show = function() {
    var self = this;

    if (self.div.className.indexOf('hide') > -1) {
        self.div.classList.remove('hide');
    }
}

UnreadTip.prototype.hide = function() {
    this.div.classList.add('hide');
}

module.exports = new UnreadTip;
