import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const files = ['adminAuth.ts','settlements.ts','dashboard.ts','logisticsCompanies.ts','data/bankCodeOptions.ts','utils/dateRange.ts','pages/DashboardPage.tsx','pages/LogisticsSettlementPage.tsx']
const compiled = Object.fromEntries(files.map(file => [file, ts.transpileModule(readFileSync(new URL('../src/'+file, import.meta.url),'utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX } }).outputText]))
const tick = () => new Promise(resolve => setImmediate(resolve))
const jsx=(type,props)=>({type,props})
function nodes(tree, name) {
  if (!tree || typeof tree !== 'object') return []
  return [...((typeof tree.type==='function'?tree.type.name:tree.type)===name ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap(child=>nodes(child,name))]
}
const company = { id:'a',businessName:'물류',businessNumber:'123',corporateRegistrationNumber:'456',businessAddress:'서울',managerName:'담당자',managerPhone:'01012345678',bankCode:'4',accountNumber:'00123',accountHolder:'예금주',active:true,mileage:3000,registeredMileage:3000,additionalUnpaidMileage:0,transferStatus:'pending' }
const data={ accumulatedMileage:3000,settlementMileage:4000,matchedCount:2,mismatchedCount:1,receipts:[],chart:[{date:'2026-08-01',common:3000,affiliation:1000}],affiliations:[{value:'a',label:'동일 이름'},{value:'b',label:'동일 이름'}] }
function mount(page='LogisticsSettlementPage') {
 const calls=[],slots=[],effects=[],downloads=[],window={location:{pathname:page==='DashboardPage'?'/dashboard':'/settlements'}};let index=0
 const imports={react:{
  useState(initial){const key=index++;if(!(key in slots))slots[key]=typeof initial==='function'?initial():initial;return[slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value}]},
  useRef(initial){const key=index++;if(!(key in slots))slots[key]={current:initial};return slots[key]},
  useEffect(fn,deps){const key=index++,old=slots[key];if(!old||deps.some((d,i)=>d!==old.deps[i]))effects.push(()=>{old?.cleanup?.();slots[key]={deps,cleanup:fn()}})},
 },'react/jsx-runtime':{jsx,jsxs:jsx}}
 const fetch=(url,options)=>{const pending=Promise.withResolvers();calls.push({url,options,...pending});return pending.promise}
 const document={createElement:()=>{const link={click(){downloads.push(link)}};return link}}
 function load(file){const exports={};new Function('require','exports','fetch','window','document',compiled[file])(name=>{if(name.endsWith('.svg'))return{default:name};if(name.endsWith('/navigation'))return{navigate:path=>{window.location.pathname=path}};assert.ok(name in imports,name);return imports[name]},exports,fetch,window,document);return exports}
 imports['./adminAuth']=imports['../adminAuth']=load('adminAuth.ts')
 imports['./data/bankCodeOptions']=load('data/bankCodeOptions.ts')
 imports['../utils/dateRange']=load('utils/dateRange.ts')
 imports['../logisticsCompanies']=load('logisticsCompanies.ts')
 imports['../settlements']=load('settlements.ts')
 imports['../dashboard']=load('dashboard.ts')
 for(const name of ['DataTable','DataPageHeader','ConfirmationDialog']) imports['../components/'+name]={[name]:name}
 imports['../components/PageFilters']={SearchFilter:'SearchFilter',DateRangeFilter:'DateRangeFilter',AffiliationFilter:'AffiliationFilter'}
 imports['../components/ConfirmationDialog'].NoticeDialog='NoticeDialog'
 const Component=load('pages/'+page+'.tsx')[page]
 const harness={calls,downloads,window,api:imports['../settlements'],dashboard:imports['../dashboard'],render(){index=0;const tree=Component();effects.splice(0).forEach(fn=>fn());return tree},unmount(){slots.forEach(s=>s?.cleanup?.())},async respond(i,status,body,headers){calls[i].resolve(body instanceof Blob?new Response(body,{status,headers}):Response.json(body,{status}));await tick()}}
 harness.render();return harness
}
const table=h=>nodes(h.render(),'DataTable')[0].props
const upload=(h,file=new File(['example'],'paid.xls'))=>{const input=nodes(h.render(),'input').find(n=>n.props.type==='file');const target={files:[file],value:'paid.xls'};input.props.onChange({currentTarget:target});assert.equal(target.value,'')}

test('settlement opens on the current KST calendar month, including month and year boundaries',()=>{
 const NativeDate=Date
 for(const [now,month] of [
  ['2025-12-31T15:00:00.000Z','2026-01'],
  ['2026-09-30T14:59:59.999Z','2026-09'],
  ['2026-09-30T15:00:00.000Z','2026-10'],
  ['2026-03-31T12:00:00.000Z','2026-03'],
 ]){
  class FrozenDate extends NativeDate {
   constructor(value){super(value ?? now)}
   static now(){return new NativeDate(now).valueOf()}
  }
  globalThis.Date=FrozenDate
  try {
   const h=mount()
   assert.equal(nodes(h.render(),'MonthFilter')[0].props.value,month)
   assert.match(h.calls[0].url,new RegExp(`month=${month}`))
  } finally {
   globalThis.Date=NativeDate
  }
 }
})

test('settlement month requests are server filtered and late replies cannot replace a newer month',async()=>{
 const h=mount();let month=nodes(h.render(),'MonthFilter')[0];month.props.onChange('2030-12');h.render();
 assert.match(h.calls[1].url,/month=2030-12/);await h.respond(1,200,[company]);await h.respond(0,200,[{...company,mileage:99}]);
 assert.equal(table(h).rows[0].mileage,3000);assert.equal(h.calls[1].options.credentials,'include')
})
test('selected settlement month is kept for list, import and export requests',async()=>{
 const h=mount();nodes(h.render(),'MonthFilter')[0].props.onChange('2030-12');h.render()
 assert.match(h.calls[1].url,/settlements\?month=2030-12/);await h.respond(1,200,[company])
 upload(h);assert.match(h.calls[2].url,/settlements\/import\?month=2030-12/);await h.respond(2,200,{completed:1,alreadyCompleted:0});h.render()
 await h.respond(3,200,[company]);nodes(h.render(),'button').find(n=>n.props.className==='floating-action').props.onClick()
 assert.match(h.calls[4].url,/settlements\/export\?month=2030-12/)
})
test('upload waits for server success, suppresses repeat clicks, then refreshes server rows',async()=>{
 const h=mount();await h.respond(0,200,[company]);upload(h);upload(h);assert.equal(h.calls.length,2)
 assert.equal(nodes(h.render(),'MonthFilter')[0].props.disabled,true);assert.ok(h.calls[1].options.body instanceof FormData)
 assert.equal(table(h).rows[0].transferStatus,'pending');await h.respond(1,200,{completed:1,alreadyCompleted:0});h.render()
 assert.equal(h.calls.length,3);await h.respond(2,200,[{...company,transferStatus:'completed'}]);assert.equal(table(h).rows[0].transferStatus,'completed')
})
test('failed and malformed uploads keep rows and show a dismissible popup before retry',async()=>{
 for(const [status,result]of [[400,{code:'SETTLEMENT_ROW_MISMATCH'}],[500,{}],[200,{completed:-1,alreadyCompleted:0}]]){
 const h=mount();await h.respond(0,200,[company]);upload(h);await h.respond(1,status,result)
 assert.deepEqual(table(h).rows,[{...company,bank:'KB국민은행'}]);assert.match(nodes(h.render(),'NoticeDialog')[0].props.message,/확인|결과/)
 nodes(h.render(),'NoticeDialog')[0].props.onClose();assert.equal(nodes(h.render(),'NoticeDialog').length,0);assert.equal(table(h).rows.length,1)
 upload(h);assert.equal(h.calls.length,3);await h.respond(2,200,{completed:0,alreadyCompleted:1});h.render();assert.equal(h.calls.length,4)
 }
})
test('late file responses after leaving do not redirect, download or refresh another page',async()=>{
 const h=mount();await h.respond(0,200,[company]);upload(h);h.unmount();h.window.location.pathname='/drivers';await h.respond(1,401,{code:'INVALID_ADMIN_SESSION'})
 assert.equal(h.window.location.pathname,'/drivers');assert.equal(h.calls.length,2);assert.equal(h.downloads.length,0)
})
test('current file session expiry redirects and invalid XLS response never downloads a fake file',async()=>{
 const h=mount();await h.respond(0,200,[company]);upload(h);await h.respond(1,401,{code:'INVALID_ADMIN_SESSION'});assert.equal(h.window.location.pathname,'/login')
 const b=mount();await b.respond(0,200,[company]);nodes(b.render(),'button').find(n=>n.props.className==='floating-action').props.onClick();await b.respond(1,200,{}, {'Content-Type':'application/json'})
 assert.equal(b.downloads.length,0);assert.equal(table(b).rows.length,1);assert.match(nodes(b.render(),'NoticeDialog')[0].props.message,/내려받지 못/)
})
test('successful empty data differs from malformed/failed settlement responses',async()=>{
 const good=mount();await good.respond(0,200,[]);assert.match(table(good).emptyMessage,/없습니다/)
 for(const result of [[{...company,mileage:null}],[{...company,mileage:9007199254740992}],[{...company,registeredMileage:-1}],[{...company,additionalUnpaidMileage:null}],[{...company,transferStatus:'sent'}]]){
 const h=mount();await h.respond(0,200,result);assert.match(nodes(h.render(),'NoticeDialog')[0].props.message,/불러오지 못/);assert.equal(table(h).emptyMessage,undefined)
 }
})
test('registration month shows its whole approved mileage beside the frozen transfer and unpaid addition',async()=>{
 const h=mount();await h.respond(0,200,[{...company,mileage:3000,registeredMileage:4200,additionalUnpaidMileage:1200,transferStatus:'completed'}])
 const t=table(h),row=t.rows[0]
 assert.match(JSON.stringify(t.columns.find(c=>c.key==='mileage').render(row)),/등록/)
 assert.match(JSON.stringify(t.columns.find(c=>c.key==='mileage').render(row)),/4,200/)
 assert.match(JSON.stringify(t.columns.find(c=>c.key==='mileage').render(row)),/3,000/)
 assert.match(JSON.stringify(t.columns.find(c=>c.key==='transferStatus').render(row)),/추가 미지급/)
 assert.match(JSON.stringify(t.columns.find(c=>c.key==='transferStatus').render(row)),/1,200/)
})
test('inactive historical settlement row preserves account and amount but has no live edit/delete operation',async()=>{
 const h=mount();await h.respond(0,200,[{...company,active:false}]);const t=table(h),actions=t.columns.find(c=>c.key==='actions').render(t.rows[0]);
 assert.equal(nodes(actions,'button')[0].props.disabled,true);assert.equal(nodes(actions,'a')[0].props.href,undefined)
 assert.equal(t.columns.find(c=>c.key==='mileage').render(t.rows[0]),'3,000')
})
test('dashboard sends dates/company IDs to the server and renders server sums without summing recent rows',async()=>{
 const h=mount('DashboardPage');await h.respond(0,200,data)
 assert.equal(nodes(h.render(),'SummaryCard')[0].props.value,'3,000');assert.equal(nodes(h.render(),'RecentReceiptCard')[0].props.receipts.length,0)
 const chart=nodes(h.render(),'MileageChart')[0];assert.deepEqual(chart.props.affiliations,data.affiliations);chart.props.onAffiliationChange('b');h.render()
 assert.match(h.calls[1].url,/logisticsCompanyId=b/);await h.respond(1,200,data);assert.equal(nodes(h.render(),'SummaryCard')[0].props.value,'3,000')
})
test('dashboard ignores stale date/affiliation responses, including late expired sessions',async()=>{
 const h=mount('DashboardPage');nodes(h.render(),'DateRangeFilter')[0].props.onChange({start:'2026-08-01',end:'2026-08-31'});h.render()
 await h.respond(1,200,data);await h.respond(0,401,{code:'INVALID_ADMIN_SESSION'});assert.equal(h.window.location.pathname,'/dashboard');assert.equal(nodes(h.render(),'SummaryCard')[0].props.value,'3,000')
})
test('dashboard zeroes require a valid success and failure leaves chart lines unavailable',async()=>{
 const h=mount('DashboardPage');await h.respond(0,200,{...data,accumulatedMileage:0,settlementMileage:0,matchedCount:0,mismatchedCount:0,chart:[]})
 assert.equal(nodes(h.render(),'SummaryCard')[0].props.value,'0');assert.equal(nodes(h.render(),'MileageChart')[0].props.loaded,true)
 const bad=mount('DashboardPage');await bad.respond(0,200,{...data,accumulatedMileage:null});assert.equal(nodes(bad.render(),'SummaryCard')[0].props.value,'-');assert.equal(nodes(bad.render(),'MileageChart')[0].props.loaded,false);assert.match(nodes(bad.render(),'NoticeDialog')[0].props.message,/불러오지 못/);assert.equal(nodes(bad.render(),'RecentReceiptCard')[0].props.message,'')
})

test('download failures keep the exact loaded rows and do not suppress an outstanding list request', async () => {
 for (const code of ['SETTLEMENT_EXPORT_EMPTY', 'SETTLEMENT_ACCOUNT_INVALID', 'INTERNAL_SERVER_ERROR']) {
  const h=mount();await h.respond(0,200,[company]);const before=table(h).rows
  nodes(h.render(),'button').find(n=>n.props.className==='floating-action').props.onClick()
  await h.respond(1,code==='INTERNAL_SERVER_ERROR'?500:400,{code})
  assert.deepEqual(table(h).rows,before);assert.equal(h.downloads.length,0)
  const notice=nodes(h.render(),'NoticeDialog')[0].props
  assert.ok(notice.message);assert.doesNotMatch(notice.message,/같은 파일|반영되지/)
  notice.onClose();assert.deepEqual(table(h).rows,before)
 }
 const h=mount();nodes(h.render(),'button').find(n=>n.props.className==='floating-action').props.onClick()
 await h.respond(1,400,{code:'SETTLEMENT_EXPORT_EMPTY'});await h.respond(0,200,[company])
 assert.equal(table(h).rows.length,1);assert.equal(nodes(h.render(),'NoticeDialog').length,1)
})

test('failed settlement refresh preserves the previous month rows and retry only replaces them on success', async () => {
 const h=mount();await h.respond(0,200,[company]);const before=table(h).rows
 nodes(h.render(),'MonthFilter')[0].props.onChange('2026-07');h.render()
 assert.deepEqual(table(h).rows,before);await h.respond(1,500,{})
 assert.deepEqual(table(h).rows,before);assert.equal(table(h).emptyMessage,undefined)
 nodes(h.render(),'NoticeDialog')[0].props.onRetry();h.render()
 assert.deepEqual(table(h).rows,before);await h.respond(2,200,[{...company,mileage:2000}])
 assert.equal(table(h).rows[0].mileage,2000);assert.equal(nodes(h.render(),'NoticeDialog').length,0)
})

test('closing an initial load error leaves neither a fake empty result nor an endless loading message', async () => {
 const h=mount();await h.respond(0,500,{})
 nodes(h.render(),'NoticeDialog')[0].props.onClose()
 assert.equal(nodes(h.render(),'NoticeDialog').length,0);assert.equal(table(h).emptyMessage,undefined)
})

test('dashboard refresh failure preserves totals, recent rows and the dates of the displayed chart', async () => {
 const h=mount('DashboardPage');await h.respond(0,200,data)
 const chart=nodes(h.render(),'MileageChart')[0].props
 nodes(h.render(),'DateRangeFilter')[0].props.onChange({start:'2026-07-01',end:'2026-07-31'});h.render()
 await h.respond(1,500,{})
 assert.equal(nodes(h.render(),'SummaryCard')[0].props.value,'3,000')
 assert.deepEqual(nodes(h.render(),'MileageChart')[0].props.dateRange,chart.dateRange)
 assert.deepEqual(nodes(h.render(),'MileageChart')[0].props.points,chart.points)
 nodes(h.render(),'NoticeDialog')[0].props.onRetry();h.render();await h.respond(2,200,{...data,accumulatedMileage:123})
 assert.equal(nodes(h.render(),'SummaryCard')[0].props.value,'123')
})

test('dismissing a file error keeps a simultaneous list failure available for retry', async () => {
 const h=mount();nodes(h.render(),'button').find(n=>n.props.className==='floating-action').props.onClick()
 await h.respond(0,500,{});await h.respond(1,400,{code:'SETTLEMENT_EXPORT_EMPTY'})
 nodes(h.render(),'NoticeDialog')[0].props.onClose()
 const notice=nodes(h.render(),'NoticeDialog')[0].props
 assert.match(notice.message,/불러오지 못/);assert.equal(typeof notice.onRetry,'function')
 notice.onRetry();h.render();await h.respond(2,200,[company]);assert.equal(table(h).rows.length,1)
})

test('failed affiliation refresh keeps the displayed chart tied to its successful query', async () => {
 const h=mount('DashboardPage');await h.respond(0,200,data)
 nodes(h.render(),'MileageChart')[0].props.onAffiliationChange('a');h.render();await h.respond(1,200,data)
 nodes(h.render(),'MileageChart')[0].props.onAffiliationChange('b');h.render();await h.respond(2,500,{})
 const chart=nodes(h.render(),'MileageChart')[0].props
 assert.equal(chart.selectedAffiliation,'b');assert.equal(chart.chartAffiliation,'a')
 assert.deepEqual(chart.points,data.chart)
 nodes(h.render(),'NoticeDialog')[0].props.onRetry();h.render();await h.respond(3,200,data)
 assert.equal(nodes(h.render(),'MileageChart')[0].props.chartAffiliation,'b')
})
