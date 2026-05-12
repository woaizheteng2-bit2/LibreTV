const CUSTOMER_SITES = {
    // ===== 🔥 大容量主力源（1000+条） =====
    baofeng: {
        api: 'https://bfzyapi.com/api.php/provide/vod/',
        name: '暴风资源',
    },
    hongniu: {
        api: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/',
        name: '红牛资源',
    },
    xinlang: {
        api: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/',
        name: '新浪资源',
    },
    haohua: {
        api: 'https://hhzyapi.com/api.php/provide/vod/',
        name: '豪华资源',
    },
    kuaiyun: {
        api: 'https://www.kuaiyunzy.com/api.php/provide/vod/',
        name: '快云资源',
    },
    modu: {
        api: 'https://caiji.moduapi.cc/api.php/provide/vod/',
        name: '魔都资源',
    },
    "360zy": {
        api: 'https://360zy.com/api.php/provide/vod/',
        name: '360资源',
    },
    piaoling: {
        api: 'https://p2100.net/api.php/provide/vod/',
        name: '飘零资源',
    },

    // ===== 📺 补充源 =====
    baidu: {
        api: 'https://api.apibdzy.com/api.php/provide/vod/',
        name: '百度资源',
    },
    wolong: {
        api: 'https://collect.wolongzyw.com/api.php/provide/vod/',
        name: '卧龙资源',
    },
    feifan: {
        api: 'http://cj.ffzyapi.com/api.php/provide/vod/',
        name: '非凡资源',
    },
    ikun: {
        api: 'https://ikunzyapi.com/api.php/provide/vod/',
        name: 'ikun资源',
    },
    jisu: {
        api: 'https://jszyapi.com/api.php/provide/vod/',
        name: '极速资源',
    },
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
