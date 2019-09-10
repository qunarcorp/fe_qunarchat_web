
[文档地址](http://hy.qunar.com/source/qunarapi.html)

## changelog

### 1.0.2

* 添加主动分享功能

### 1.0.3

* 添加ready容错
* 添加log方法
* 添加uelog方法
* 生命周期的API方法精简
    * <del>onBeforeShow</del>
    * <del>onBeforeHide</del>
    * <del>onDestroy</del>
    * onShow 保留
    * onHide 保留
* navigation 支持text,location两种方式，原有的segment删除
* getIDs合并到getDeviceInfo
* <del>syncLogin</del>

### 1.0.4

* bugfix

### 1.0.5

* 添加QunarAPI.sniff。暴露当前运行环境
* 添加QunarAPI.error方法。在bridge注入失败时触发
* H5版本，添加checkJsApi方法

### 1.0.6

* bugfix。onNavClick点击返回按钮事件处理优化

### 1.0.7

* 添加H5版本的login功能
* 添加min版本

## 1.0.8 

* bug fix。解决设置分享无法重复回调的问题

## 1.0.9 

* bug fix。解决不支持分享接口无限循环的问题

## 1.0.10

* syncLoginFromTouch。从touch端同步cookie到客户端
* brige注入失败触发时机修改。domready => window.onload
