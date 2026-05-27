
// Premium HTML Canvas Dynamic Graphic Image Poster Maker – Admin Panel Version
// ROLE: Generates and downloads the poster image to the device gallery.
// After downloading, admin taps "Step 2: WhatsApp" in the modal to send the
// downloaded image to the responsible person via WhatsApp.
function generateAndSharePosterImage(type, referenceKey, targetLang) {
    const lang = targetLang || currentLanguage;
    const canvasTitle = document.getElementById('canvasDynamicTitle');
    const canvasBody  = document.getElementById('canvasDynamicBody');

    // Apply translations to the poster's hardcoded headers
    document.getElementById('posterMainTitle').innerText   = i18n[lang].posterTitle;
    document.getElementById('posterSubTitle').innerText    = i18n[lang].posterSubtitle;
    document.getElementById('posterBrandTitle').innerText  = i18n[lang].posterDawat;
    document.getElementById('posterActionTitle').innerText = i18n[lang].posterCall;
    document.getElementById('posterFooterText').innerText  = i18n[lang].posterFooter;

    const canvasContainer = document.getElementById('imagePosterGeneratorCanvas');
    canvasContainer.setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');

    let filename = "Qurbani-Campaign-Poster.png";

    let targetRow = null;

    if (type === 'location') {
        targetRow = sheetDataset.find(row => String(row["نمبر شمار"]) === String(referenceKey));
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
    }

    if (typeof showToast === "function") {
        showToast(i18n[lang].sharingPoster, "info");
    }

    const captureCanvasTarget = document.getElementById('imagePosterGeneratorCanvas');

    // Generate the canvas at 3× resolution for a crisp, high-quality image
    htmlToImage.toPng(captureCanvasTarget, { pixelRatio: 3.0, backgroundColor: '#022c22' })
        .then(dataUrl => {

            // ── Download poster image to device gallery ──────────────────────
            const anchor = document.createElement('a');
            anchor.download = filename;
            anchor.href = dataUrl;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);

            // ── Log the share action to Google Sheets ────────────────────────
            if (targetRow && typeof logShareToSheet === "function") {
                logShareToSheet(targetRow, lang, 'poster');
            }

            // ── Guide the admin to the next step ────────────────────────────
            if (typeof showToast === "function") {
                const nextStepMsg = lang === 'ur'
                    ? "✅ پوسٹر ڈاؤن لوڈ ہو گیا! اب 'اسٹیپ 2' دبائیں اور گیلری سے تصویر شامل کر کے بھیجیں۔"
                    : "✅ Poster downloaded! Now tap 'Step 2' to open WhatsApp and attach this image.";
                showToast(nextStepMsg, "success");
            }
        })
        .catch(err => {
            console.error('Error generating poster image:', err);
            if (typeof showToast === "function") {
                showToast("پوسٹر بنانے میں خرابی آئی ہے / Error generating poster", "error");
            }
        });
}