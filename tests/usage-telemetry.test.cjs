const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const gas=fs.readFileSync('코드 작업/GAS_전체스크립트.gs','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
new vm.Script(gas);
const events=[],posts=[];
const c={location:{search:'?analytics_debug=1'},URLSearchParams,crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},
  localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},setTimeout:()=>1,clearTimeout(){},
  gtag:(...a)=>events.push(a),fetch:(url,o)=>{posts.push(JSON.parse(o.body));return Promise.resolve();},API:'stub',
  DB:{carNames:['쏘나타'],carFuels:['LPG']},LIC_REGIONS:['서울특별시'],MONTH_OPTIONS:[24,36,48,60],
  providedRateByMonths:()=>6.2,carOptSelOf:car=>car.optSel||[],carOptsOf:()=>[{n:'선루프'}],CONFIGS:[{},{}]};
vm.createContext(c);
vm.runInContext(html.slice(html.indexOf('// Selection telemetry:'),html.indexOf('function newCfg(){')),c);
vm.runInContext('usageStarted=true;recordUsageSelections()',c);assert.equal(posts.length,0);assert.equal(events.length,0);
c.CONFIGS[0]={licSet:true,licRegion:'서울특별시',name:'PRIVATE',phone:'01012345678',licPrice:123456};
vm.runInContext('recordUsageSelections();flushUsage(0)',c);
assert.equal(events[0][1],'quote_selection_updated');assert.equal(posts[0].selection.complete,false);
c.CONFIGS[0].car={idx:0,payType:'전액할부',months:36,optSel:['선루프'],baseOvr:9876543};
c.CONFIGS[0].ins={type:'공제',combine:true};c.CONFIGS[0].work={};
vm.runInContext('recordUsageSelections();flushUsage(0)',c);
assert.equal(posts[1].selection.complete,true);assert.equal(posts[1].revision,2);
assert(events.some(e=>e[1]==='quote_option_changed'&&e[2].selected));
const count=events.length;vm.runInContext('recordUsageSelections()',c);assert.equal(events.length,count);
c.CONFIGS[0].car.optSel=[];vm.runInContext('recordUsageSelections();flushUsage(0)',c);
assert(events.some(e=>e[1]==='quote_option_changed'&&!e[2].selected));
vm.runInContext('usageCompared[0]=true;recordUsageSelections();flushUsage(0)',c);
assert.equal(posts.at(-1).selection.comparison_viewed,true);
assert(posts.every(p=>p.quoteId===posts[0].quoteId));
assert(!JSON.stringify({events,posts}).match(/PRIVATE|01012345678|9876543|123456"|baseOvr|licPrice/));
vm.runInContext('usageDisabled=true',c);const postCount=posts.length;c.CONFIGS[0].car.months=60;
vm.runInContext('recordUsageSelections();flushUsage(0)',c);assert.equal(posts.length,postCount);

const rows=[];let released=0;
const sheet={getLastRow:()=>rows.length,setFrozenRows(){},getRange(r,col,n=1,w=1){return {
  getValue:()=>rows[r-1]?.[col-1]??'',
  getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>rows[r+i-1]?.[col+j-1]??'')),
  setValues(values){values.forEach((v,i)=>{rows[r+i-1]??=[];v.forEach((x,j)=>rows[r+i-1][col+j-1]=x);});},setNumberFormat(){},
  createTextFinder(id){return {matchEntireCell(){return this;},useRegularExpression(){return this;},findNext(){const i=rows.findIndex((v,k)=>k>0&&v[0]===id);return i<0?null:{getRow:()=>i+1};}};}
};}};
let created=false;
const server={Number,Date,SS_ID:'stub',ContentService:{createTextOutput:x=>x},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>created?sheet:null,insertSheet:name=>{assert.equal(name,'계산기 이용내역');created=true;return sheet;}})}};
vm.createContext(server);vm.runInContext(gas,server);
assert.equal(server.saveCalculatorUsage_(posts[0]),'ok');assert.equal(rows.length,2);
assert.equal(server.saveCalculatorUsage_(posts[3]),'ok');assert.equal(rows.length,2);
assert.equal(rows[1][5],'완성');assert.equal(rows[1][6],'Y');
assert.equal(server.saveCalculatorUsage_(posts[1]),'stale');assert.equal(rows[1][4],posts[3].revision);
const malicious={...posts[3],revision:99,selection:{...posts[3].selection,car_name:'=IMPORTXML("bad")'},phone:'PRIVATE'};
assert.equal(server.saveCalculatorUsage_(malicious),'ok');assert(rows[1][12].startsWith("'="));assert(!JSON.stringify(rows).includes('PRIVATE'));
assert.equal(server.saveCalculatorUsage_({...malicious,quoteId:'bad'}),'invalid id');
assert.equal(server.saveCalculatorUsage_({...malicious,revision:0}),'invalid revision');
assert.equal(server.saveCalculatorUsage_({...malicious,quoteId:posts[0].quoteId.replace(/1$/,'2')}),'invalid selection');
const firstBlock=JSON.stringify(rows[1].slice(4,27));
const second={...posts[0],quoteId:posts[0].quoteId.replace(/1$/,'2'),selection:{...posts[0].selection,config_number:2,car_name:'아이오닉5'}};
assert.equal(server.saveCalculatorUsage_(second),'ok');assert.equal(rows.length,2);
assert.equal(rows[1][27],1);assert.equal(rows[1][35],'아이오닉5');
assert.equal(JSON.stringify(rows[1].slice(4,27)),firstBlock);
assert.equal(server.saveCalculatorUsage_(second),'stale');
const secondBlock=JSON.stringify(rows[1].slice(27));
assert.equal(server.saveCalculatorUsage_({...malicious,revision:100}),'ok');
assert.equal(JSON.stringify(rows[1].slice(27)),secondBlock);
assert.equal(server.saveCalculatorUsage_({...posts[0],quoteId:'87654321-1234-1234-1234-123456789012-1'}),'ok');
assert.equal(rows.length,3);
assert(released>=4);
assert.equal(fs.readFileSync('preview/index.html','utf8'),html);
assert.equal(fs.readFileSync('코드 작업/taxi_calculator_v2.0_navy.html','utf8'),html);
console.log('PASS: selection changes, option removal, incomplete/complete, dedup, opt-out, privacy, upsert, stale revisions, validation, formula escaping, synchronization');
