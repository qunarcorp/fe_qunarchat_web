// 正确的使用姿势

// 第一步，设置默认参数
QunarAPI.config({
    debug: false
});

// 第二步，在ready回调函数内做一些事情
QunarAPI.ready(function(){
    // do something
    
    // 检测接口
    QunarAPI.checkJsApi( {
        jsApiList: ['login'],
        success: function(res){
            console.log(res)
        },
        fail: function(res){
            console.log(res)
        }
    } );
})
