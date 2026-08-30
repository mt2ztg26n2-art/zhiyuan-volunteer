/* 演示数据生成器：供「清除数据恢复演示数据」按钮使用（与纯净种子分离） */
window.buildDemoData=function(){
  const now = ()=>{ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
  return {
    school:'四川省宣汉职业中专学校', schoolShort:'宣汉职校',
    league:'中国共产主义青年团宣汉职业中专学校委员会', leagueShort:'校团委',
    period:'2026 秋季学期',
    users:[
      {id:'u-super',role:'super',org:'超级管理员',name:'系统管理员',idCard:'000000000000000001',pwd:'admin123',phone:'13900000001',email:'admin@xhzx.edu.cn',title:'超级管理员',avatar:'',dept:'',cls:'',gender:'男',nation:'汉族',politics:'中共党员',position:'会长',activated:true},
      {id:'u-term',role:'terminal',org:'校团委',name:'校团委管理员',idCard:'000000000000000002',pwd:'term123',phone:'13900000002',title:'管理员',avatar:'',dept:'',cls:'',activated:true},
      {id:'u-prez',role:'president',org:'青年志愿者协会',name:'张志远',idCard:'000000000000000003',pwd:'prez123',phone:'13900000003',title:'会 长',avatar:'',dept:'综合高中',cls:'24级综合高中1班',gender:'男',nation:'汉族',politics:'共青团员',position:'会长',activated:true},
      {id:'u-vice',role:'vice',org:'青年志愿者协会',name:'李欣怡',idCard:'000000000000000004',pwd:'vice123',phone:'13900000004',title:'副会长',avatar:'',dept:'财经',cls:'25级会计2班',gender:'女',nation:'汉族',politics:'共青团员',position:'副会长',activated:true},
      {id:'u-min',role:'minister',org:'青年志愿者协会',name:'王浩然',idCard:'000000000000000005',pwd:'min123',phone:'13900000005',title:'部长',avatar:'',dept:'电子',cls:'24级电子2班',gender:'男',nation:'汉族',politics:'共青团员',position:'部长',activated:true},
      {id:'u-bc',role:'broadcaster',org:'广播站',name:'陈思雨',idCard:'000000000000000006',pwd:'bc123',phone:'13900000006',title:'广播员',avatar:'',dept:'航高',cls:'24级航空3班',gender:'女',nation:'汉族',politics:'共青团员',position:'广播员',activated:true},
      {id:'u-et',role:'etiquette',org:'礼仪队',name:'赵雨涵',idCard:'000000000000000007',pwd:'et123',phone:'13900000007',title:'礼仪队员',avatar:'',dept:'现代服务',cls:'24级幼保1班',gender:'女',nation:'汉族',politics:'共青团员',position:'队员',activated:true},
      {id:'u-sl',role:'subleague',org:'团副总支',name:'刘子涵',idCard:'000000000000000008',pwd:'sl123',phone:'13900000008',title:'副总支副书记',avatar:'',dept:'机建',cls:'24级机电1班',gender:'男',nation:'汉族',politics:'共青团员',position:'副书记',activated:true},
      {id:'u-mem',role:'member',org:'青年志愿者协会',name:'杨静雯',idCard:'000000000000000009',pwd:'mem123',phone:'13900000009',title:'志愿者',avatar:'',dept:'综合高中',cls:'25级综合高中2班',gender:'女',nation:'汉族',politics:'群众',position:'志愿者',activated:true},
      {id:'u-m1',role:'member',org:'广播站',name:'宋佳怡',idCard:'000000000000000010',pwd:'mem123',phone:'13900000010',title:'广播员',avatar:'',dept:'航高',cls:'25级航空1班',gender:'女',nation:'汉族',politics:'共青团员',position:'广播员',activated:true},
      {id:'u-m2',role:'member',org:'广播站',name:'罗一鸣',idCard:'000000000000000011',pwd:'mem123',phone:'13900000011',title:'广播员',avatar:'',dept:'航高',cls:'25级航空2班',gender:'男',nation:'汉族',politics:'群众',position:'广播员',activated:true},
      {id:'u-m3',role:'member',org:'广播站',name:'唐婉清',idCard:'000000000000000012',pwd:'mem123',phone:'13900000012',title:'广播员',avatar:'',dept:'航高',cls:'25级航空3班',gender:'女',nation:'汉族',politics:'共青团员',position:'广播员',activated:true},
      {id:'u-m4',role:'member',org:'礼仪队',name:'林雨欣',idCard:'000000000000000013',pwd:'mem123',phone:'13900000013',title:'礼仪队员',avatar:'',dept:'现代服务',cls:'24级幼保1班',gender:'女',nation:'汉族',politics:'共青团员',position:'礼仪队员',activated:true},
      {id:'u-m5',role:'member',org:'礼仪队',name:'冯雅婷',idCard:'000000000000000014',pwd:'mem123',phone:'13900000014',title:'礼仪队员',avatar:'',dept:'现代服务',cls:'24级幼保2班',gender:'女',nation:'汉族',politics:'群众',position:'礼仪队员',activated:true},
      {id:'u-m6',role:'member',org:'礼仪队',name:'黄可馨',idCard:'000000000000000015',pwd:'mem123',phone:'13900000015',title:'礼仪队员',avatar:'',dept:'现代服务',cls:'25级养护1班',gender:'女',nation:'汉族',politics:'共青团员',position:'礼仪队员',activated:true},
      {id:'u-m7',role:'member',org:'团副总支',name:'何俊杰',idCard:'000000000000000016',pwd:'mem123',phone:'13900000016',title:'副总支成员',avatar:'',dept:'机建',cls:'24级机电1班',gender:'男',nation:'汉族',politics:'共青团员',position:'成员',activated:true},
      {id:'u-m8',role:'member',org:'团副总支',name:'周子昂',idCard:'000000000000000017',pwd:'mem123',phone:'13900000017',title:'副总支成员',avatar:'',dept:'机建',cls:'25级机电1班',gender:'男',nation:'汉族',politics:'群众',position:'成员',activated:true},
      {id:'u-m9',role:'member',org:'团副总支',name:'吴梦洁',idCard:'000000000000000018',pwd:'mem123',phone:'13900000018',title:'副总支成员',avatar:'',dept:'机建',cls:'25级机电2班',gender:'女',nation:'汉族',politics:'共青团员',position:'成员',activated:true},
      {id:'u-dev',role:'dev',org:'开发人员',name:'开发维护',idCard:'000000000000000099',pwd:'dev123',phone:'13900000099',title:'系统开发',avatar:'',dept:'',cls:'',activated:true}
    ],
    dictionaries:{
      role:[
        {val:'super',label:'超级管理员'},{val:'terminal',label:'终端管理员'},{val:'president',label:'会 长'},
        {val:'vice',label:'副 会 长'},{val:'minister',label:'部长/站长'},{val:'broadcaster',label:'广播站员'},
        {val:'etiquette',label:'礼仪队员'},{val:'subleague',label:'团副总支'},{val:'member',label:'志愿者'},{val:'dev',label:'开发人员'}
      ],
      gender:['男','女'],
      nation:['汉族','藏族','彝族','回族','壮族','苗族','羌族','土家族','蒙古族','其他'],
      politics:['群众','共青团员','中共党员','中共预备党员','民盟盟员','无党派人士'],
      religion:['无','佛教','道教','伊斯兰教','天主教','基督教','其他'],
      education:['初中','高中','中专','大专','本科'],
      live:['住校','走读'],
      workExp:['是','否'], acceptMgmt:['是','否'], langQuality:['是','否'],
      departments:['综合高中','财经','电子','航高','机建','现代服务'],
      classes:{
        '综合高中':['24级综合高中1班','24级综合高中2班','25级综合高中1班','25级综合高中2班','25级综合高中3班'],
        '财经':['24级会计1班','24级会计2班','25级会计1班','25级会计2班','25级金融1班','25级金融2班'],
        '电子':['24级电子1班','24级电子2班','25级电子1班','25级电子2班','25级化工1班'],
        '航高':['24级航空1班','24级航空2班','24级航空3班','25级航空1班','25级航空2班','25级航空3班','25级航空4班'],
        '机建':['24级机电1班','24级机电2班','24级机电3班','25级机电1班','25级机电2班'],
        '现代服务':['24级幼保1班','24级幼保2班','25级养护1班','25级养护2班','25级养护3班','25级养护4班']
      },
      organizations:['团委办公室','青年志愿者协会','广播站','礼仪队','团副总支','团总支','学生会','专业团支部'],
      grades:['23级','24级','25级']
    },
    rules:{ scorePerPerson:0.1, deptMultiplier:0.5 },
    services:[
      {id:'s-1',dept:'综合高中',cls:'24级综合高中2班',name:'陈昕',idCard:'513022200703120011',activity:'五四诵唱比赛彩排',startDT:'2026-04-21 14:00',endDT:'2026-04-21 16:30',days:3,location:'校前广场',serviceBy:'张志远',recordType:'manual',createdAt:'2026-04-22 09:00'},
      {id:'s-2',dept:'综合高中',cls:'25级综合高中2班',name:'杨静雯',idCard:'000000000000000009',activity:'五四诵唱比赛',startDT:'2026-04-27 14:00',endDT:'2026-04-27 17:00',days:3,location:'体育馆',serviceBy:'李欣怡',recordType:'signin',createdAt:'2026-04-28 09:00'},
      {id:'s-3',dept:'财经',cls:'25级会计2班',name:'李欣怡',idCard:'000000000000000004',activity:'五四诵唱比赛彩排',startDT:'2026-04-21 14:00',endDT:'2026-04-21 17:00',days:3,location:'校前广场',serviceBy:'张志远',recordType:'manual',createdAt:'2026-04-22 09:00'},
      {id:'s-4',dept:'财经',cls:'25级金融1班',name:'周芷若',idCard:'513022200703120013',activity:'乐器搬运',startDT:'2026-04-22 08:00',endDT:'2026-04-22 11:30',days:3,location:'校体育馆',serviceBy:'王浩然',recordType:'manual',createdAt:'2026-04-23 09:00'},
      {id:'s-5',dept:'电子',cls:'25级电子2班',name:'吴梓涵',idCard:'513022200703120014',activity:'五四诵唱比赛',startDT:'2026-04-23 14:00',endDT:'2026-04-23 17:00',days:2,location:'体育馆',serviceBy:'王浩然',recordType:'signin',createdAt:'2026-04-24 09:00'},
      {id:'s-6',dept:'电子',cls:'25级化工1班',name:'范雨桐',idCard:'513022200703120015',activity:'2026年团员培训',startDT:'2026-05-01 09:00',endDT:'2026-05-01 12:00',days:2,location:'阶梯教室',serviceBy:'王浩然',recordType:'manual',createdAt:'2026-05-02 09:00'},
      {id:'s-7',dept:'航高',cls:'24级航空3班',name:'郑琪琪',idCard:'513022200703120016',activity:'校内礼仪',startDT:'2026-04-21 13:30',endDT:'2026-04-21 17:00',days:1,location:'校前广场',serviceBy:'陈思雨',recordType:'signin',createdAt:'2026-04-22 09:00'},
      {id:'s-8',dept:'航高',cls:'25级航空1班',name:'苏宇轩',idCard:'513022200703120017',activity:'五四诵唱比赛颁奖',startDT:'2026-04-27 16:30',endDT:'2026-04-27 18:30',days:1,location:'体育馆',serviceBy:'陈思雨',recordType:'signin',createdAt:'2026-04-28 09:00'},
      {id:'s-9',dept:'航高',cls:'25级航空2班',name:'聂思琪',idCard:'513022200703120018',activity:'五四诵唱比赛颁奖',startDT:'2026-04-27 16:30',endDT:'2026-04-27 18:30',days:1,location:'体育馆',serviceBy:'陈思雨',recordType:'signin',createdAt:'2026-04-28 09:00'},
      {id:'s-10',dept:'航高',cls:'25级航空3班',name:'刘星雨',idCard:'513022200703120019',activity:'校内礼仪',startDT:'2026-04-29 13:30',endDT:'2026-04-29 17:00',days:1,location:'校前广场',serviceBy:'陈思雨',recordType:'signin',createdAt:'2026-04-30 09:00'},
      {id:'s-11',dept:'航高',cls:'25级航空4班',name:'许若曦',idCard:'513022200703120020',activity:'校内礼仪',startDT:'2026-04-29 13:30',endDT:'2026-04-29 17:00',days:1,location:'校前广场',serviceBy:'陈思雨',recordType:'signin',createdAt:'2026-04-30 09:00'},
      {id:'s-12',dept:'机建',cls:'24级机电1班',name:'刘子涵',idCard:'000000000000000008',activity:'五四诵唱比赛',startDT:'2026-04-23 14:00',endDT:'2026-04-23 17:00',days:2,location:'体育馆',serviceBy:'王浩然',recordType:'signin',createdAt:'2026-04-24 09:00'},
      {id:'s-13',dept:'机建',cls:'24级机电3班',name:'钱浩然',idCard:'513022200703120022',activity:'乐器搬运',startDT:'2026-04-22 08:00',endDT:'2026-04-22 11:30',days:3,location:'校体育馆',serviceBy:'王浩然',recordType:'manual',createdAt:'2026-04-23 09:00'}
    ],
    activities:[
      {id:'a-1',title:'2026年五四诵唱比赛志愿服务',startDT:'2026-04-27 13:00',endDT:'2026-04-27 18:00',location:'校体育馆',organizer:'青年志愿者协会',intro:'协助布置场地、引导观众、颁奖礼仪。',status:'open',need:50,signups:[],covers:[],signin:{start:'2026-04-27 12:30',end:'2026-04-27 13:30'},createdBy:'张志远',createdAt:'2026-04-25 09:00'},
      {id:'a-2',title:'校园文明劝导志愿行动',startDT:'2026-04-21 12:00',endDT:'2026-04-21 17:00',location:'校园主干道',organizer:'青年志愿者协会',intro:'对校园不文明行为进行劝导。',status:'open',need:30,signups:[],covers:[],signin:{start:'2026-04-21 11:30',end:'2026-04-21 12:00'},createdBy:'李欣怡',createdAt:'2026-04-19 09:00'}
    ],
    tasks:[
      {id:'t-1',title:'整理 4 月活动档案',type:'任务',startDT:'2026-04-30 18:00',endDT:'2026-05-02 18:00',publisher:'会长 张志远',intro:'整理 4 月份所有活动档案并归档。',status:'open',reads:[],signups:[],createdAt:'2026-04-30 09:00'},
      {id:'t-2',title:'五四诵唱比赛报名',type:'活动',startDT:'2026-04-23 09:00',endDT:'2026-04-25 18:00',publisher:'超级管理员',intro:'请各专业部动员成员参加五四诵唱比赛。',status:'open',reads:[],signups:[],createdAt:'2026-04-22 09:00'}
    ],
    news:[
      {id:'n-1',title:'关于表彰 2026 年 4 月志愿服务先进集体和优秀个人的通报',type:'通报',priority:'置顶',publisher:'校团委',publishedAt:'2026-04-30 16:00',reads:120,content:'2026 年 4 月，全校青年志愿者在我校各项大型活动中无私奉献，决定对以下集体和个人予以表彰。',photos:[]},
      {id:'n-2',title:'志愿服务智慧管理平台正式上线',type:'新闻',priority:'推荐',publisher:'青年志愿者协会',publishedAt:'2026-04-28 09:00',reads:86,content:'为推进志愿服务信息化管理，我校志愿服务智慧管理平台今日正式启用。',photos:[]}
    ],
    notifies:[
      {id:'nt-1',to:'超级管理员',kind:'audit',title:'新注册待审核',content:'小张 提交注册，请审核',time:'2026-08-29 11:00',unread:true,pending:true},
      {id:'nt-2',to:'all',kind:'sys',title:'平台上线通知',content:'志愿服务智慧管理平台正式上线，欢迎试用。',time:'2026-08-28 09:00',unread:true,pending:false},
      {id:'nt-3',to:'all',kind:'act',title:'新活动发布',content:'《2026年五四诵唱比赛志愿服务》招募中',time:'2026-04-25 09:00',unread:false,pending:false},
      {id:'nt-4',to:'会 长',kind:'audit',title:'待审团员名额申请',content:'2026 上期有 2 名同学提交团员名额推荐，请审核',time:'2026-04-20 10:00',unread:true,pending:true},
      {id:'nt-5',to:'all',kind:'news',title:'4 月志愿服务之星揭晓',content:'本月服务时长 TOP3 已公布，请到数据中心查看',time:'2026-04-30 09:00',unread:false,pending:false}
    ],
    activities:[
      {id:'act-1',title:'2026 年五四诵唱比赛志愿服务',desc:'负责比赛现场秩序、接待嘉宾、舞台协助',cover:'',date:'2026-04-30',location:'校田径场',startDT:'2026-04-30 13:00',endDT:'2026-04-30 18:00',signupLimit:30,signups:['u-mem','u-m4','u-m5'],publisher:'校团委',status:'published',createdAt:'2026-04-20 09:00',covers:[]},
      {id:'act-2',title:'校园招聘志愿服务',desc:'协助企业布展、引导毕业生',cover:'',date:'2026-05-15',location:'学校体育馆',startDT:'2026-05-15 08:00',endDT:'2026-05-15 17:00',signupLimit:25,signups:['u-prez','u-vice'],publisher:'青年志愿者协会',status:'published',createdAt:'2026-05-10 10:00',covers:[]},
      {id:'act-3',title:'社区老人关爱志愿活动',desc:'走进社区陪伴老人聊天、打扫',cover:'',date:'2026-04-12',location:'宣汉县社区服务中心',startDT:'2026-04-12 14:00',endDT:'2026-04-12 17:00',signupLimit:20,signups:['u-mem','u-m6','u-m9'],publisher:'青年志愿者协会',status:'completed',createdAt:'2026-04-08 14:00',covers:[]}
    ],
    tasks:[
      {id:'task-1',title:'本周校园卫生志愿者值日',publisher:'青年志愿者协会',startDT:'2026-04-15 08:00',endDT:'2026-04-15 12:00',status:'open',signups:['u-prez','u-vice','u-mem'],createdAt:'2026-04-14 10:00'},
      {id:'task-2',title:'图书馆整理上架',publisher:'青年志愿者协会',startDT:'2026-04-20 14:00',endDT:'2026-04-20 17:00',status:'open',signups:['u-mem'],createdAt:'2026-04-19 09:00'}
    ],
    services:[
      {id:'s-1',name:'杨静雯',idCard:'000000000000000009',dept:'综合高中',cls:'25级综合高中2班',org:'青年志愿者协会',activity:'校园招聘志愿服务',startDT:'2026-05-15 08:00',endDT:'2026-05-15 12:00',duration:4,location:'学校体育馆',serviceBy:'张志远',createdAt:'2026-05-15 12:30'},
      {id:'s-2',name:'林雨欣',idCard:'000000000000000013',dept:'现代服务',cls:'24级幼保1班',org:'礼仪队',activity:'校园招聘志愿服务接待',startDT:'2026-05-15 08:00',endDT:'2026-05-15 12:00',duration:4,location:'学校体育馆',serviceBy:'赵雨涵',createdAt:'2026-05-15 12:30'},
      {id:'s-3',name:'冯雅婷',idCard:'000000000000000014',dept:'现代服务',cls:'24级幼保2班',org:'礼仪队',activity:'校园招聘志愿服务接待',startDT:'2026-05-15 08:00',endDT:'2026-05-15 12:00',duration:4,location:'学校体育馆',serviceBy:'赵雨涵',createdAt:'2026-05-15 12:30'},
      {id:'s-4',name:'何俊杰',idCard:'000000000000000016',dept:'机建',cls:'24级机电1班',org:'团副总支',activity:'社区老人关爱志愿活动',startDT:'2026-04-12 14:00',endDT:'2026-04-12 17:00',duration:3,location:'宣汉县社区服务中心',serviceBy:'刘子涵',createdAt:'2026-04-12 17:30'},
      {id:'s-5',name:'吴梦洁',idCard:'000000000000000018',dept:'机建',cls:'25级机电2班',org:'团副总支',activity:'社区老人关爱志愿活动',startDT:'2026-04-12 14:00',endDT:'2026-04-12 17:00',duration:3,location:'宣汉县社区服务中心',serviceBy:'刘子涵',createdAt:'2026-04-12 17:30'},
      {id:'s-6',name:'宋佳怡',idCard:'000000000000000010',dept:'航高',cls:'25级航空1班',org:'广播站',activity:'五四诵唱比赛播音',startDT:'2026-04-30 13:00',endDT:'2026-04-30 18:00',duration:5,location:'校田径场',serviceBy:'陈思雨',createdAt:'2026-04-30 18:30'}
    ],
    broadcastRecs:[
      {id:'br-1',date:'2026-04-28',title:'校园安全提醒',minutes:10,broadcaster:'陈思雨',publisher:'陈思雨',createdAt:'2026-04-28 12:00'},
      {id:'br-2',date:'2026-04-29',title:'五四诵唱比赛预告',minutes:8,broadcaster:'宋佳怡',publisher:'陈思雨',createdAt:'2026-04-29 12:00'},
      {id:'br-3',date:'2026-04-30',title:'志愿服务表彰通报',minutes:12,broadcaster:'罗一鸣',publisher:'陈思雨',createdAt:'2026-04-30 18:00'}
    ],
    etiquetteRecs:[
      {id:'er-1',date:'2026-04-15',title:'校园开放日礼仪接待',leaders:['赵雨涵','林雨欣','冯雅婷'],count:8,publisher:'赵雨涵',createdAt:'2026-04-15 17:00'},
      {id:'er-2',date:'2026-05-15',title:'校园招聘接待礼仪',leaders:['赵雨涵','林雨欣'],count:6,publisher:'赵雨涵',createdAt:'2026-05-15 12:00'}
    ],
    subleagueRecs:[
      {id:'sr-1',date:'2026-04-12',title:'社区老人关爱志愿服务',participants:['何俊杰','吴梦洁','周子昂'],count:15,publisher:'刘子涵',createdAt:'2026-04-12 18:00'},
      {id:'sr-2',date:'2026-04-25',title:'团支部组织生活会',participants:['何俊杰','周子昂','吴梦洁'],count:18,publisher:'刘子涵',createdAt:'2026-04-25 18:00'}
    ],
    quotas:[
      {id:'q-1',name:'李欣怡',idCard:'000000000000000004',dept:'财经',cls:'25级会计2班',kind:'自荐',status:'review',reason:'积极参与志愿活动，服务时长累计 30 小时',trace:[{act:'提交申请',st:'recommend',time:now()},{act:'推荐送审',st:'review',time:now()}],createdAt:now()},
      {id:'q-2',name:'王浩然',idCard:'000000000000000005',dept:'电子',cls:'24级电子2班',kind:'推荐',status:'review',reason:'担任部长表现突出，志愿服务时长 50 小时',trace:[{act:'提交申请',st:'recommend',time:now()},{act:'推荐送审',st:'review',time:now()}],createdAt:now()}
    ],
    logs:[], reports:[], summaries:[], traces:[],
    nextIds:{user:200,service:100,activity:10,task:10,news:10,notify:10,summary:10,report:10}
  };
}
