function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const now = data.timestamp ? new Date(data.timestamp) : new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;
    
    let isHold = 'No';
    if (data.selected_option && data.selected_option.includes('保留')) {
        isHold = 'Yes';
    }
    
    const headers = [
      'Timestamp(記録日)', 
      'Participant_ID', 
      'Attempt_No(回数)',
      'Difficulty', 
      'Started_At', 
      'Card_No', 
      'Scanned_At', 
      'Thinking_Time_Sec(試行時間)', 
      'X_px', 
      'Y_px', 
      'Room_Name(部屋名)',        
      'Received_Time(受信時刻)',  
      'Record_Type', 
      '4M_E_Category',             
      'S_A_B_C_Eval',              
      'Is_Hold(保留したか)',         
      'Log_ID', 
      'Selected_Option', 
      'Option_Score', 
      'Raw_JSON'
    ];
    
    const rowData = [
      now,                                                                
      data.participant_id || '',                                          
      data.attempt_no || '',                                              
      data.difficulty || '',                                              
      data.started_at || '',                                              
      data.card_no || '',                                                 
      data.scanned_at || '',                                              
      data.thinking_time_sec !== undefined ? data.thinking_time_sec : '', 
      data.x_px || '',                                        
      data.y_px || '',                                        
      data.location_name || '',                                           
      timeString,                                                         
      data.record_type || '',                                             
      data.m4e_category || data['4M+E'] || '',                            
      data.sabc_eval || data['S/A/B/C評価'] || '',                        
      isHold,                                                             
      data.log_id || '',                                                  
      data.selected_option || '',                                         
      data.option_score !== undefined ? data.option_score : '',           
      JSON.stringify(data)                                                
    ];
    
    // 1. ALL_LOGS
    let masterSheet = ss.getSheetByName('ALL_LOGS');
    if (!masterSheet) {
      masterSheet = ss.insertSheet('ALL_LOGS');
      masterSheet.appendRow(headers);
    }
    masterSheet.appendRow(rowData);
    
    // 2. Individual sheets
    const recordType = (data.record_type || 'OTHER').toUpperCase();
    let targetSheetName = 'OTHER_LOGS';
    if (recordType === 'EVENT') targetSheetName = 'EVENT';
    else if (recordType === 'ITEM') targetSheetName = 'ITEM';
    else if (recordType === 'CHECK') targetSheetName = 'CHECK';
    
    let targetSheet = ss.getSheetByName(targetSheetName);
    if (!targetSheet) {
      targetSheet = ss.insertSheet(targetSheetName);
      targetSheet.appendRow(headers);
    }
    targetSheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
