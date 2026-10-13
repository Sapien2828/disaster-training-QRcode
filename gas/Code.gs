function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const sheetName = data.record_type || 'RAW_LOGS';
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        'Timestamp(記録日)', 
        'Participant_ID', 
        'Difficulty', 
        'Started_At', 
        'Card_No', 
        'Scanned_At', 
        'Thinking_Time_Sec(試行時間)', 
        'X_px', 
        'Y_px', 
        'Record_Type', 
        'Log_ID', 
        'Selected_Option', 
        'Option_Score', 
        'Raw_JSON'
      ]);
    }
    
    sheet.appendRow([
      data.timestamp ? new Date(data.timestamp) : new Date(), 
      data.participant_id || '',                              
      data.difficulty || '',                                  
      data.started_at || '',                                  
      data.card_no || '',                                     
      data.scanned_at || '',                                  
      data.thinking_time_sec !== undefined ? data.thinking_time_sec : '', 
      data.x_px || '',                                        
      data.y_px || '',                                        
      data.record_type || '',                                 
      data.log_id || '',                                      
      data.selected_option || '',                             
      data.option_score !== undefined ? data.option_score : '', 
      JSON.stringify(data)                                    
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
