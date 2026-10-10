function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const sheetName = data.record_type || 'RAW_LOGS';
    let sheet = ss.getSheetByName(sheetName);
    
    // シートが存在しない場合は新規作成し、指定されたヘッダー行をセット
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
    
    // 指定された順序(A列～N列)でデータを追記
    sheet.appendRow([
      data.timestamp ? new Date(data.timestamp) : new Date(), // A列: 日付
      data.participant_id || '',                              // B列: 参加者ID
      data.difficulty || '',                                  // C列: 初級、中級など
      data.started_at || '',                                  // D列: 訓練開始日(セッション開始)
      data.card_no || '',                                     // E列: QRコード番号
      data.scanned_at || '',                                  // F列: 読み取り時間
      data.thinking_time_sec !== undefined ? data.thinking_time_sec : '', // G列: 試行時間(秒)
      data.x_px || '',                                        // H列: map X座標
      data.y_px || '',                                        // I列: map Y座標
      data.record_type || '',                                 // J列: record_type
      data.log_id || '',                                      // K列: log_id
      data.selected_option || '',                             // L列: 選んだ選択肢
      data.option_score !== undefined ? data.option_score : '', // M列: その選択肢の点数
      JSON.stringify(data)                                    // N列: (予備)全データJSON
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
