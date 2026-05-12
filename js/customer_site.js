const CUSTOMER_SITES = {
    // ===== 全能型主力源 =====
    hongniu: {
        api: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/',
        name: '红牛资源',
    },
    wolong: {
        api: 'https://collect.wolongzyw.com/api.php/provide/vod/',
        name: '卧龙资源',
    },
    huayao: {
        api: 'https://www.huayaozy.com/api.php/provide/vod/',
        name: '虎牙资源',
    },
    kuaihe: {
        api: 'https://caiji.kczyapi.com/api.php/provide/vod/',
        name: '快车资源',
    },
    qiqi: {
        api: 'https://www.qiqidys.com/api.php/provide/vod',
        name: '七七资源',
    },

    // ===== 高清/无广告切片源 =====
    feifan: {
        api: 'http://cj.ffzyapi.com/api.php/provide/vod/',
        name: '非凡资源',
    },
    sony: {
        api: 'https://suoniapi.com/api.php/provide/vod/',
        name: '索尼资源',
    },
    youzhi: {
        api: 'http://api.1080zyku.com/inc/api.php/provide/vod',
        name: '优质资源库',
    },
    jinying: {
        api: 'https://jyzyapi.com/api.php/provide/vod/',
        name: '金鹰资源',
    },

    // ===== 海外与特定类型互补源 =====
    haiwaikan: {
        api: 'https://haiwaikan.com/api.php/provide/vod/',
        name: '海外看资源',
    },
    baidu: {
        api: 'https://api.apibdzy.com/api.php/provide/vod/',
        name: '百度资源',
    },
    feisu: {
        api: 'https://www.feisuzyapi.com/api.php/provide/vod/',
        name: '飞速资源',
    },
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
