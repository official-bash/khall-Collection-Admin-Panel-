// ⚠️ CRITICAL CONFIGURATION: READS CAMPAIGN DATA (Existing Main App Sheet Script URL)
const API_URL = "https://script.google.com/macros/s/AKfycbxq_kNwzQxXiNxWuDyx8p6fNJ47UDOkwcdniy7v7qqw2MXXHsnDwhwmgauto0JK4zZ_/exec";

// ⚠️ ADMIN ACTION CONFIGURATION: WRITE-ONLY SHARE LOG (New Dedicated Sheet Script URL)
const ADMIN_LOG_API_URL = "https://script.google.com/macros/s/AKfycbzQTRIZw5CfFVed5yqoViJYEVFTAR2_9SnSxlDdpyW3sRVYaOlVvY2CqGaXsfM7mu6i/exec";

// ─── Global Highly Robust Phone Number Formatter for WhatsApp (wa.me) ───────
function formatPhoneNumberForWhatsApp(phone) {
    if (!phone) return "";
    
    // 1. Convert Urdu/Arabic digits to English digits
    let str = String(phone);
    const urduDigits = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
    const arabicDigits = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
    
    str = str.replace(/[۰-۹]/g, d => urduDigits[d] || d);
    str = str.replace(/[٠-٩]/g, d => arabicDigits[d] || d);
    
    // 2. Remove all non-numeric characters
    let clean = str.replace(/\D/g, "");
    
    // 3. Normalize Pakistani mobile numbers to international format
    if (clean.startsWith("0092")) {
        clean = clean.substring(2);
    } else if (clean.startsWith("92") && clean.length === 12) {
        // perfect format (923xxxxxxxxx)
    } else if (clean.startsWith("03") && clean.length === 11) {
        clean = "92" + clean.substring(1);
    } else if (clean.startsWith("3") && clean.length === 10) {
        clean = "92" + clean;
    } else if (clean.startsWith("0") && clean.length === 11) {
        clean = "92" + clean.substring(1);
    }
    
    return clean;
}