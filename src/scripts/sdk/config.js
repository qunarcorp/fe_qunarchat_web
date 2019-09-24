var sniff = require('lib/sniff/sniff.js');

var domain = window.nav_igator.baseaddess.xmpp;
var settings = {
    server: {
        bosh_service_url: domain + 'http-bind/',
        webSocket_boah_service_url: 'ws:' + domain + ':5280/websocket',
        http_api_server: domain + 'api/'
    },
    // 设备类型
    maType: sniff.iphone ? 8 : sniff.ipod ? 9 : sniff.ipad ? 10 : sniff.android ? 11 : sniff.pc ? 6 : 7,
    // 支持consult的白名单
    // consultWhiteList: {
    //     callcenter: true
    // },
    uploadFileSizeLimit: {
        size: 1024 * 1024 * 5,
        text: '2 MB'
    },
    isClient: sniff.qunar,
    isAndroidOld: false,
    defaultHeadImage: '../../assets/png/defaultAvatar.png'
};

module.exports = {
    domain: domain,
    settings: settings
};
