select public.admin_notify(
  '✅ 24/7 Watchdog LIVE — हर मिनट जांच',
  'मालिक, अब दो पहरेदार बिना रुके चलेंगे: (1) Database हर 1 मिनट में user panel + admin panel दोनों खोलकर जांचता है — नीचे-से-नीचे हर मिनट 200 OK दर्ज हो रहा है। (2) GitHub हर 5 मिनट में panels + database-watchdog खुद की जांच करता है। कोई panel 2 मिनट से ज़्यादा डाउन हुआ तो आपके phone पर सीधा push + admin panel की घंटी बजेगी (30 मिनट में एक बार, बार-बार तंग नहीं करेगा)। Slow net के लिए admin panel का self-refresh अब 3 कोशिशें (20 सेकंड गैप) करता है। — आपका agent',
  'success'
) as notify_result;
