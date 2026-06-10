// Dev-only: inline GAS includes into a single standalone HTML for local browser testing.
// Not pushed to GAS (lives outside src/). google.script.run is stubbed -> localStorage-only mode.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

// Replace <?!= include('X'); ?> with the file contents of src/X.html
html = html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, name) => {
  return fs.readFileSync(path.join(SRC, name + '.html'), 'utf8');
});

// Stub server bridge so the app runs without GAS.
// Emulates both durable backends on localStorage. ?backend=sheet forces the sheet path.
const stub = `
<script>
  window.google = { script: { run: (function(){
    const params=new URLSearchParams(location.search);
    const driveOk = params.get('backend')!=='sheet';
    const DK='mc_drive_local', SK='mc_sheet_local';
    const rd=(K)=>{ try{ return JSON.parse(localStorage.getItem(K)||'{}'); }catch(e){ return {}; } };
    const wr=(K,o)=>localStorage.setItem(K, JSON.stringify(o));
    function ctx(){
      const c={ _s:null, _f:null };
      c.withSuccessHandler=(f)=>{ c._s=f; return c; };
      c.withFailureHandler=(f)=>{ c._f=f; return c; };
      c.probeDurable=()=>{ c._s&&c._s({drive:driveOk, sheet:true}); };
      // drive backend
      c.driveSave=(id,json)=>{ const d=rd(DK); d[id]={json,updatedAt:Date.now()}; wr(DK,d); c._s&&c._s({id,updatedAt:Date.now()}); };
      c.driveLoad=(id)=>{ const d=rd(DK); c._s&&c._s(d[id]?d[id].json:null); };
      c.driveList=()=>{ const d=rd(DK); c._s&&c._s(Object.keys(d).map(id=>({id,updatedAt:d[id].updatedAt}))); };
      c.driveDelete=(id)=>{ const d=rd(DK); delete d[id]; wr(DK,d); c._s&&c._s(true); };
      // sheet backend
      c.sheetSave=(id,json,name,mode,updatedAt)=>{ const d=rd(SK); d[id]={json,name,mode,updatedAt:updatedAt||Date.now()}; wr(SK,d); c._s&&c._s({id,updatedAt:updatedAt||Date.now()}); };
      c.sheetLoad=(id)=>{ const d=rd(SK); c._s&&c._s(d[id]?d[id].json:null); };
      c.sheetList=()=>{ const d=rd(SK); c._s&&c._s(Object.keys(d).map(id=>({id,name:d[id].name,mode:d[id].mode,updatedAt:d[id].updatedAt}))); };
      c.sheetDelete=(id)=>{ const d=rd(SK); delete d[id]; wr(SK,d); c._s&&c._s(true); };
      return c;
    }
    // top-level proxy: any access returns a fresh chainable context
    return new Proxy({}, { get:(_,k)=>{ const c=ctx(); return typeof c[k]==='function'?c[k].bind(c):c[k]; } });
  })() } };
</script>
`;
html = html.replace('</head>', stub + '\n</head>');

const out = path.join(__dirname, 'local_preview.html');
fs.writeFileSync(out, html);
console.log('wrote', out, '(' + html.length + ' bytes)');
