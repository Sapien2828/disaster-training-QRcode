function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Choose sheet based on record_type
    const sheetName = data.record_type || 'RAW_LOGS';
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['log_id', 'session_id', 'participant_id', 'record_type', 'timestamp']);
    }
    
    sheet.appendRow([
      data.log_id,
      data.session_id,
      data.participant_id,
      data.record_type,
      new Date(data.timestamp)
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
