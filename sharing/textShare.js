// Text Post Sharing Service – Admin Panel Version
function shareTextMessage(referenceKey, targetLang) {
    const lang = targetLang || currentLanguage;
    const targetRow = sheetDataset.find(row => String(row["نمبر شمار"]) === String(referenceKey));
    if (!targetRow) return;

    const srNo = targetRow["نمبر شمار"];

    // Extract localized attributes
    let ucName, pointName, address, responsiblePerson;

    if (lang === 'ur') {
        ucName            = targetRow["یو سی"] || "";
        pointName         = targetRow["پوائنٹ کا نام"] || `پوائنٹ #${srNo}`;
        address           = targetRow["پوائنٹ کا ایڈریس"] || "";
        responsiblePerson = targetRow["پوائنٹ ذمہ دار"] || "";
    } else {
        ucName            = targetRow["uc"] || "";
        pointName         = targetRow["Point Name"] || `Point #${srNo}`;
        address           = targetRow["location points"] || "";
        responsiblePerson = targetRow["Point responsible"] || "";
    }

    // Coordinates mapping
    let sharedMapLink = targetRow["Google Map Link"] ? targetRow["Google Map Link"].trim() : "";
    if (!sharedMapLink && targetRow["cordinates"]) {
        const cleanCoords = targetRow["cordinates"].trim();
        if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(cleanCoords)) {
            sharedMapLink = "https://maps.google.com/?q=" + cleanCoords;
        } else if (cleanCoords.startsWith("http://") || cleanCoords.startsWith("https://")) {
            sharedMapLink = cleanCoords;
        }
    }

    // Format bilingual headers
    let headingText, subheadingText, brandText, callToActionText;

    if (lang === 'ur') {
        headingText       = "قربانی کی کھالیں";
        subheadingText    = "عاشقانِ رسول کی دینی تحریک";
        brandText         = "دعوتِ اسلامی";
        callToActionText  = "کو دے کر دینی کاموں میں حصہ لیجیے!";
    } else {
        headingText       = "Qurbani Hides";
        subheadingText    = "Religious Movement of Ashiqan-e-Rasool";
        brandText         = "Dawat-e-Islami";
        callToActionText  = "Donate your hides and participate in religious work!";
    }

    let textMessage = `🌟 *${headingText}* 🌟\n✨ *${subheadingText}* ✨\n🕌 *${brandText}* 🕌\n📢 *${callToActionText}*\n\n`;

    if (lang === 'ur') {
        textMessage += `🏢 *یو سی (UC):* ${ucName}\n`;
        textMessage += `🏠 *پتہ:* ${address}\n`;
        textMessage += `👤 *ذمہ دار:* ${responsiblePerson}\n`;
        textMessage += `📞 *رابطہ نمبر:* ${targetRow["موبائل نمبر"]}\n`;
        if (sharedMapLink) textMessage += `🗺️ *گوگل میپ لوکیشن:* ${sharedMapLink}\n`;
    } else {
        textMessage += `🏢 *Union Council (UC):* ${ucName}\n`;
        textMessage += `🏠 *Address:* ${address}\n`;
        textMessage += `👤 *Person in Charge:* ${responsiblePerson}\n`;
        textMessage += `📞 *Mobile Number:* ${targetRow["موبائل نمبر"]}\n`;
        if (sharedMapLink) textMessage += `🗺️ *Google Map Link:* ${sharedMapLink}\n`;
    }

    textMessage += `\n🔗 https://official-bash.github.io/Khall-Collection_Cantt-Town/`;

    // Format phone number to standard international format for WhatsApp wa.me using global robust formatter
    const cleanPhone = formatPhoneNumberForWhatsApp(targetRow["موبائل نمبر"]);

    // Direct WhatsApp send using wa.me (opens official WhatsApp directly with ready-to-send text)
    if (cleanPhone) {
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMessage)}`;
        
        // Log the share to the Google Sheet immediately
        if (typeof logShareToSheet === "function") {
            logShareToSheet(targetRow, lang, 'text');
        }
        
        window.open(waUrl, "_blank");
    } else {
        // Fallback: If no phone number, open general Share sheet or copy to clipboard
        if (navigator.share) {
            navigator.share({
                title: i18n[lang].title,
                text: textMessage
            })
            .then(() => {
                if (typeof showToast === "function") {
                    showToast(i18n[lang].successShare, "success");
                }
                if (typeof logShareToSheet === "function") {
                    logShareToSheet(targetRow, lang, 'text');
                }
            })
            .catch(err => {
                console.log("Share failed:", err);
                navigator.clipboard.writeText(textMessage).then(() => {
                    if (typeof showToast === "function") {
                        showToast(i18n[lang].textCopied, "success");
                    }
                }).catch(() => {});
            });
        } else {
            navigator.clipboard.writeText(textMessage).then(() => {
                if (typeof showToast === "function") {
                    showToast(i18n[currentLanguage].textCopied, "success");
                }
            }).catch(() => {});
        }
    }
}