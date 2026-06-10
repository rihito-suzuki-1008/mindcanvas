/**
 * MindCanvas — server side
 * - doGet: serve the single-page web app
 * - include: inline CSS/JS partials into index.html
 * - drive*: durable backup of projects as JSON files in a dedicated Drive folder
 */

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('MindCanvas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---------- Drive backup ----------

var MC_FOLDER_NAME = 'MindCanvas';

function mc_getFolder_() {
  var it = DriveApp.getFoldersByName(MC_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(MC_FOLDER_NAME);
}

function mc_fileName_(id) {
  return 'mc_' + id + '.json';
}

/** Upsert a project JSON. Returns {id, fileId, updatedAt}. */
function driveSave(id, json) {
  var folder = mc_getFolder_();
  var name = mc_fileName_(id);
  var it = folder.getFilesByName(name);
  var file;
  if (it.hasNext()) {
    file = it.next();
    file.setContent(json);
  } else {
    file = folder.createFile(name, json, 'application/json');
  }
  return { id: id, fileId: file.getId(), updatedAt: file.getLastUpdated().getTime() };
}

/** Returns the stored JSON string for a project id, or null. */
function driveLoad(id) {
  var folder = mc_getFolder_();
  var it = folder.getFilesByName(mc_fileName_(id));
  if (it.hasNext()) return it.next().getBlob().getDataAsString();
  return null;
}

/** Returns [{id, updatedAt}] for all backed-up projects. */
function driveList() {
  var folder = mc_getFolder_();
  var it = folder.getFiles();
  var out = [];
  while (it.hasNext()) {
    var f = it.next();
    var nm = f.getName();
    if (nm.indexOf('mc_') === 0 && nm.lastIndexOf('.json') === nm.length - 5) {
      out.push({ id: nm.substring(3, nm.length - 5), updatedAt: f.getLastUpdated().getTime() });
    }
  }
  return out;
}

/** Trash a project's backup file. Returns true if found. */
function driveDelete(id) {
  var folder = mc_getFolder_();
  var it = folder.getFilesByName(mc_fileName_(id));
  if (it.hasNext()) {
    it.next().setTrashed(true);
    return true;
  }
  return false;
}

// ---------- Backend probe ----------

/** Report which durable backends are usable in this environment. */
function probeDurable() {
  var out = { drive: false, sheet: false };
  try { DriveApp.getRootFolder(); out.drive = true; } catch (e) {}
  try { if (SpreadsheetApp.getActiveSpreadsheet()) out.sheet = true; } catch (e) {}
  return out;
}

// ---------- Spreadsheet backend (container-bound) ----------
// 1 row = 1 project in a hidden sheet. Uses spreadsheets.currentonly scope.

var MC_DATA_SHEET = '_mc_data';
var MC_HEADERS = ['id', 'name', 'mode', 'updatedAt', 'json'];

function mc_dataSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No bound spreadsheet');
  var sh = ss.getSheetByName(MC_DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(MC_DATA_SHEET);
    sh.appendRow(MC_HEADERS);
    try { sh.hideSheet(); } catch (e) {}
  }
  return sh;
}

function mc_findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

/** Upsert a project into the data sheet. */
function sheetSave(id, json, name, mode, updatedAt) {
  var sh = mc_dataSheet_();
  var values = [id, name || '', mode || '', updatedAt || Date.now(), json];
  var row = mc_findRow_(sh, id);
  if (row > 0) sh.getRange(row, 1, 1, MC_HEADERS.length).setValues([values]);
  else sh.appendRow(values);
  return { id: id, updatedAt: updatedAt || Date.now() };
}

/** Returns the stored JSON string for a project id, or null. */
function sheetLoad(id) {
  var sh = mc_dataSheet_();
  var row = mc_findRow_(sh, id);
  if (row < 0) return null;
  return sh.getRange(row, 5).getValue() || null; // json column (E)
}

/** Returns [{id, name, mode, updatedAt}] for all stored projects. */
function sheetList() {
  var sh = mc_dataSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 4).getValues(); // id,name,mode,updatedAt
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    out.push({ id: String(vals[i][0]), name: vals[i][1], mode: vals[i][2], updatedAt: Number(vals[i][3]) || 0 });
  }
  return out;
}

/** Delete a project's row. Returns true if found. */
function sheetDelete(id) {
  var sh = mc_dataSheet_();
  var row = mc_findRow_(sh, id);
  if (row > 0) { sh.deleteRow(row); return true; }
  return false;
}
