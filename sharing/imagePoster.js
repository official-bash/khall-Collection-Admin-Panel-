
// Premium HTML Canvas Dynamic Graphic Image Poster Maker – Admin Panel Version
function generateAndSharePosterImage(type, referenceKey, targetLang) {
    const lang = targetLang || currentLanguage;
    const canvasTitle = document.getElementById('canvasDynamicTitle');
    const canvasBody  = document.getElementById('canvasDynamicBody');

    // Temporarily apply translations to the poster's hardcoded headers
    document.getElementById('posterMainTitle').innerText  = i18n[lang].posterTitle;
    document.getElementById('posterSubTitle').innerText   = i18n[lang].posterSubtitle;
    document.getElementById('posterBrandTitle').innerText = i18n[lang].posterDawat;
    document.getElementById('posterActionTitle').innerText = i18n[lang].posterCall;
    document.getElementById('posterFooterText').innerText  = i18n[lang].posterFooter;

    const canvasContainer = document.getElementById('imagePosterGeneratorCanvas');
    canvasContainer.setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');

    let filename    = "Qurbani-Campaign-Poster.png";
    let textMessage = lang === 'ur'
        ? `قربانی کی کھالیں مہم 2026 - دعوتِ اسلامی کینٹ ٹاؤن راولپنڈی\n\n`
        : `Qurbani Hides Campaign 2026 - Dawat-e-Islami Cantt Town Rawalpindi\n\n`;

    let targetRow = null;

    if (type === 'location') {
        targetRow = sheetDataset.find(row => row["نمبر شمار"] === referenceKey);
        if (!targetRow) return;

        canvasTitle.innerText = `${targetRow["یو سی"]}`;
        filename = `${targetRow["یو سی"]}-پوائنٹ-${referenceKey}.png`;

        const address = lang === 'ur'
            ? (targetRow["پوائنٹ کا ایڈریس"] || targetRow["location points"] || '')
            : (targetRow["location points"]  || targetRow["پوائنٹ کا ایڈریس"] || '');

        const responsiblePerson = lang === 'ur'
            ? (targetRow["پوائنٹ ذمہ دار"] || "")
            : (targetRow["Point responsible"] || targetRow["پوائنٹ ذمہ دار"] || "");

        // Premium enhanced HTML structure inside the poster details card
        canvasBody.innerHTML = `
            <div class="text-center bg-black/45 p-4 rounded-2xl border border-yellow-500/20" style="margin-bottom: 12px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
                <span class="text-yellow-300 font-extrabold text-xs block mb-1.5 font-nastaliq">📍 ${i18n[lang].posterAddress}</span>
                <p class="text-xl font-bold text-white leading-relaxed font-nastaliq">${address}</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-black/45 p-3.5 rounded-2xl border border-yellow-500/20 text-center">
                    <span class="text-emerald-300 text-xs font-extrabold block mb-1.5 font-nastaliq">👤 ${i18n[lang].posterRep}</span>
                    <span class="text-base text-slate-100 font-bold leading-normal font-nastaliq">${responsiblePerson}</span>
                </div>
                <div class="bg-black/45 p-3.5 rounded-2xl border border-yellow-500/20 text-center">
                    <span class="text-emerald-300 text-xs font-extrabold block mb-1.5 font-nastaliq">📞 ${i18n[lang].posterPhone}</span>
                    <span class="text-base font-mono text-yellow-100 font-black tracking-wide leading-normal">${targetRow["موبائل نمبر"]}</span>
                </div>
            </div>
        `;

        let sharedMapLink = targetRow["Google Map Link"] ? targetRow["Google Map Link"].trim() : "";
        if (!sharedMapLink && targetRow["cordinates"]) {
            const cleanCoords = targetRow["cordinates"].trim();
            if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(cleanCoords)) {
                sharedMapLink = "https://maps.google.com/?q=" + cleanCoords;
            } else if (cleanCoords.startsWith("http://") || cleanCoords.startsWith("https://")) {
                sharedMapLink = cleanCoords;
            }
        }
        if (lang === 'ur') {
            textMessage += `📍 یو سی: ${targetRow["یو سی"]}\n🏠 ایڈریس: ${address}\n👤 ذمہ دار: ${responsiblePerson}\n📞 رابطہ نمبر: ${targetRow["موبائل نمبر"]}\n`;
            if (sharedMapLink) textMessage += `🗺️ میپ لوکیشن: ${sharedMapLink}\n`;
        } else {
            textMessage += `📍 UC: ${targetRow["uc"] || targetRow["یو سی"]}\n🏠 Address: ${address}\n👤 Responsible: ${responsiblePerson}\n📞 Contact: ${targetRow["موبائل نمبر"]}\n`;
            if (sharedMapLink) textMessage += `🗺️ Map Location: ${sharedMapLink}\n`;
        }
        textMessage += `\n🔗 https://official-bash.github.io/Khall-Collection_Cantt-Town/`;
    }

    if (typeof showToast === "function") {
        showToast(i18n[lang].sharingPoster, "info");
    }

    const captureCanvasTarget = document.getElementById('imagePosterGeneratorCanvas');

    // Set scale to 3.0 for crisp, ultra-high-definition sharing images
    htmlToImage.toPng(captureCanvasTarget, { pixelRatio: 3.0, backgroundColor: '#022c22' })
        .then(dataUrl => {
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const imgFile = new File([blob], filename, { type: 'image/png' });

                    if (navigator.canShare && navigator.canShare({ files: [imgFile] })) {
                        navigator.share({
                            files: [imgFile],
                            title: i18n[lang].title,
                            text: textMessage
                        })
                        .then(() => {
                            if (typeof showToast === "function") {
                                showToast(i18n[lang].successShare, "success");
                            }
                            // Log the share to Google Sheets after successful poster share
                            if (targetRow && typeof logShareToSheet === "function") {
                                logShareToSheet(targetRow, lang, 'poster');
                            }
                        })
                        .catch(err => {
                            console.log("Poster share cancelled/failed, downloading locally:", err);
                            fallbackDownloadMechanism(dataUrl, filename);
                        });
                    } else {
                        fallbackDownloadMechanism(dataUrl, filename);
                    }
                });
        })
        .catch(err => {
            console.error('Error generating image', err);
        });
}

function fallbackDownloadMechanism(dataUrl, name) {
    if (typeof showToast === "function") {
        showToast("Downloading Poster / پوسٹر ڈاؤن لوڈ ہو رہا ہے", "info");
    }
    const anchor = document.createElement('a');
    anchor.download = name;
    anchor.href = dataUrl;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}