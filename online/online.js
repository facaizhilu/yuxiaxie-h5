// 旧版入口（已废弃）：被手机缓存的旧页面加载到这里时，强制刷新为新版
(function(){var k='yxx_old_reload';if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');fetch('/',{cache:'reload'}).finally(function(){location.replace('/?r='+Date.now());});})();
