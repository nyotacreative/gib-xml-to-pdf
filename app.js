document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const invoiceFrame = document.getElementById('invoiceFrame');
    const previewPlaceholder = document.querySelector('.preview-placeholder');
    const fileInfoTitle = document.querySelector('.file-info h2');
    const fileInfoDesc = document.querySelector('.file-info p');
    
    const btnPrint = document.getElementById('btnPrint');
    const btnDownloadPDF = document.getElementById('btnDownloadPDF');

    let filesData = [];
    let activeFileId = null;
    let currentRenderedHtml = '';

    const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
    const MAX_ZIP_XML_FILES = 100;

    // --- Drag and Drop: entire sidebar is the drop zone ---
    sidebar.addEventListener('click', (e) => {
        // Don't open picker when clicking a file-item or remove button
        if (e.target.closest('.file-item, .made-by-link')) return;
        fileInput.click();
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        sidebar.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        sidebar.addEventListener(eventName, () => sidebar.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        sidebar.addEventListener(eventName, () => sidebar.classList.remove('drag-over'), false);
    });

    sidebar.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
        this.value = '';
    });

    // --- File Handling ---
    async function handleFiles(files) {
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = file.name.split('.').pop().toLowerCase();

            if (file.size > MAX_UPLOAD_BYTES) {
                alert(`Dosya çok büyük olduğu için atlandı: ${file.name}\nEn fazla 25 MB dosya yükleyebilirsiniz.`);
                continue;
            }

            if (extension === 'xml') {
                const text = await file.text();
                addFileToList(file.name, text);
            } else if (extension === 'zip') {
                await processZip(file);
            } else {
                alert(`Desteklenmeyen formattaki dosya atlandı: ${file.name}\nLütfen XML veya ZIP dosyası yükleyin.`);
            }
        }
    }

    async function processZip(zipFile) {
        try {
            if (!window.JSZip) {
                alert("ZIP desteği yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.");
                return;
            }

            const zip = new JSZip();
            const contents = await zip.loadAsync(zipFile);
            
            let xmlCount = 0;
            const promises = [];
            contents.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.xml') && !relativePath.startsWith('__MACOSX/')) {
                    xmlCount += 1;
                    if (xmlCount > MAX_ZIP_XML_FILES) return;

                    promises.push(
                        zipEntry.async('string').then(text => {
                            addFileToList(zipEntry.name, text);
                        })
                    );
                }
            });
            await Promise.all(promises);

            if (xmlCount > MAX_ZIP_XML_FILES) {
                alert(`ZIP içindeki ilk ${MAX_ZIP_XML_FILES} XML dosyası işlendi. Daha büyük arşivler tarayıcı performansı için sınırlandırılır.`);
            } else if (xmlCount === 0) {
                alert("ZIP içinde XML dosyası bulunamadı.");
            }
        } catch (error) {
            console.error("ZIP işlenirken hata oluştu:", error);
            alert("ZIP dosyasını okurken bir hata oluştu.");
        }
    }

    function addFileToList(filename, content) {
        const id = window.crypto?.randomUUID?.() || Date.now().toString() + Math.random().toString(36).slice(2, 8);
        
        filesData.push({
            id,
            name: filename,
            content: content
        });

        renderFileList();
        
        // Auto select the first newly added file if none is selected
        if (filesData.length === 1 || !activeFileId) {
            selectFile(id);
        }
    }

    function renderFileList() {
        if (filesData.length === 0) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-file-dashed"></i>
                    <p>Henüz fatura yüklenmedi.</p>
                </div>
            `;
            return;
        }

        fileList.innerHTML = '';
        filesData.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = `file-item ${file.id === activeFileId ? 'active' : ''}`;
            fileItem.addEventListener('click', () => selectFile(file.id));

            const ext = file.name.split('.').pop().toLowerCase();

            const icon = document.createElement('i');
            icon.className = 'ph ph-file-code';

            const details = document.createElement('div');
            details.className = 'file-details';

            const filename = document.createElement('div');
            filename.className = 'filename';
            filename.title = file.name;
            filename.textContent = file.name;

            const filetype = document.createElement('div');
            filetype.className = 'filetype';
            filetype.textContent = `${ext.toUpperCase()} Dosyası`;

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-btn';
            removeButton.type = 'button';
            removeButton.title = 'Kaldır';
            removeButton.setAttribute('aria-label', `${file.name} dosyasını kaldır`);
            removeButton.addEventListener('click', (event) => removeFile(event, file.id));

            const removeIcon = document.createElement('i');
            removeIcon.className = 'ph ph-trash';

            details.append(filename, filetype);
            removeButton.append(removeIcon);
            fileItem.append(icon, details, removeButton);
            fileList.appendChild(fileItem);
        });
    }

    function removeFile(e, id) {
        e.stopPropagation(); // prevent clicking the file
        filesData = filesData.filter(f => f.id !== id);
        
        if (activeFileId === id) {
            activeFileId = null;
            clearPreview();
            
            // select latest available
            if (filesData.length > 0) {
                selectFile(filesData[filesData.length - 1].id);
            }
        }
        
        renderFileList();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeRenderedHtml(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        doc.querySelectorAll('script, iframe, object, embed, form, input, button, textarea, select, meta[http-equiv="refresh"]').forEach(el => el.remove());

        doc.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim();

                if (name.startsWith('on') || name === 'srcdoc') {
                    el.removeAttribute(attr.name);
                    return;
                }

                if (['href', 'src', 'xlink:href', 'formaction'].includes(name) && /^(javascript:|data:text\/html)/i.test(value)) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
    }

    function getActiveFile() {
        return filesData.find(file => file.id === activeFileId);
    }

    function toPdfFilename(filename) {
        const baseName = (filename || 'gib-belgesi')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^\p{L}\p{N}._-]+/gu, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 90);

        return `${baseName || 'gib-belgesi'}.pdf`;
    }

    function injectPrintStyles(htmlString) {
        const printStyles = `
        <style>
            @page {
                size: A4 portrait;
                margin: 0;
            }
            @media print {
                body { margin: 0; padding: 0; }
                .page { width: 100% !important; min-height: unset !important; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                thead { display: table-header-group; }
            }
        </style>`;

        return htmlString.includes('</head>')
            ? htmlString.replace('</head>', `${printStyles}</head>`)
            : `${printStyles}${htmlString}`;
    }

    // --- XML to HTML Transformation ---
    function selectFile(id) {
        activeFileId = id;
        renderFileList(); // Update active class
        
        const file = getActiveFile();
        if (!file) return;

        fileInfoTitle.textContent = file.name;
        fileInfoDesc.textContent = 'Görüntüleniyor...';

        try {
            renderInvoice(file);
        } catch (error) {
            console.error("Fatura render hatası:", error);
            alert("Faturayı dönüştürürken bir hata oluştu. XML formatı desteklenmiyor veya bozuk olabilir.");
            clearPreview();
        }
    }

    function renderInvoice(file) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(file.content, "text/xml");
        
        // Find parsing errors
        const parseError = xmlDoc.querySelector("parsererror");
        if (parseError) {
            throw new Error("XML Parsing Error");
        }

        // Try to find the XSLT element inside the document
        let xsltElements = Array.from(xmlDoc.getElementsByTagName('*')).filter(el => {
            return el.localName === 'EmbeddedDocumentBinaryObject' && 
                   ((el.getAttribute('filename') && el.getAttribute('filename').includes('.xslt')) || 
                   el.getAttribute('mimeCode') === 'application/xml');
        });

        if (xsltElements.length === 0) {
            const stylesheet = xmlDoc.querySelector('xml-stylesheet');
            console.log("No embedded XSLT found.");
        }
        
        let xsltString = null;
        if (xsltElements.length > 0) {
            try {
                const base64 = xsltElements[0].textContent;
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                xsltString = new TextDecoder('utf-8').decode(bytes);
            } catch (e) {
                console.error("XSLT decode hatası:", e);
                 xsltString = atob(xsltElements[0].textContent);
            }
        }

        let htmlString = "";

        if (!xsltString) {
            console.log("XSLT bulunamadı, fallback devreye giriyor.");
            htmlString = generateFallbackHtml(xmlDoc);
        } else {
            const xsltDoc = parser.parseFromString(xsltString, "text/xml");
            const xsltProcessor = new XSLTProcessor();
            xsltProcessor.importStylesheet(xsltDoc);
            
            const resultDocument = xsltProcessor.transformToDocument(xmlDoc);
            if (!resultDocument) {
                throw new Error("XSLT Transformation Failed");
            }

            const serializer = new XMLSerializer();
            htmlString = serializer.serializeToString(resultDocument);
        }

        currentRenderedHtml = sanitizeRenderedHtml(htmlString);

        previewPlaceholder.style.display = 'none';
        invoiceFrame.style.display = 'block';
        invoiceFrame.srcdoc = currentRenderedHtml;
        
        fileInfoDesc.textContent = 'Ön izleme aktif';
        enableButtons();
    }

    function generateFallbackHtml(xmlDoc) {
        let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    font-family: 'Inter', Arial, sans-serif;
                    background: #fff;
                    color: #1e293b;
                    font-size: 12px;
                    line-height: 1.6;
                    padding: 0;
                }

                /* A4 page wrapper */
                .page {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                    padding: 0;
                    background: #fff;
                }

                /* Header banner */
                .doc-header {
                    background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 60%, #7c3aed 100%);
                    color: white;
                    padding: 28px 32px 24px;
                }
                .doc-header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                }
                .doc-header h1 {
                    font-size: 20px;
                    font-weight: 700;
                    letter-spacing: -0.3px;
                    margin-bottom: 4px;
                }
                .doc-header .subtitle {
                    font-size: 11px;
                    opacity: 0.75;
                    font-weight: 400;
                }
                .doc-badge {
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.25);
                    border-radius: 6px;
                    padding: 8px 14px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #e9d5ff;
                }
                .header-divider {
                    border-top: 1px solid rgba(255,255,255,0.2);
                    margin: 16px 0 0;
                }
                .doc-header-ids {
                    display: flex;
                    gap: 32px;
                    padding-top: 14px;
                }
                .header-id-group label {
                    display: block;
                    font-size: 9px;
                    opacity: 0.6;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    margin-bottom: 3px;
                }
                .header-id-group span {
                    font-size: 12px;
                    font-weight: 600;
                    font-family: 'Courier New', monospace;
                    color: #e9d5ff;
                }

                /* Body */
                .doc-body {
                    padding: 28px 32px;
                }

                /* Two column info grid */
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .info-card {
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .info-card-header {
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 8px 14px;
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #64748b;
                }
                .info-card-body {
                    padding: 12px 14px;
                }
                .data-row {
                    display: flex;
                    margin-bottom: 8px;
                    font-size: 11px;
                }
                .data-row:last-child { margin-bottom: 0; }
                .data-label {
                    font-weight: 600;
                    width: 100px;
                    flex-shrink: 0;
                    color: #64748b;
                }
                .data-value {
                    flex: 1;
                    color: #0f172a;
                    font-weight: 500;
                    word-break: break-all;
                }
                .data-value.mono {
                    font-family: 'Courier New', monospace;
                    font-size: 10px;
                    color: #6d28d9;
                    font-weight: 700;
                }

                /* Table section */
                .section-title {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: #4c1d95;
                    margin-bottom: 10px;
                    padding-bottom: 6px;
                    border-bottom: 2px solid #ddd6fe;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }
                thead tr {
                    background: #1e1b4b;
                    color: white;
                }
                thead th {
                    padding: 10px 12px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                thead th:last-child { text-align: right; }
                tbody td {
                    padding: 9px 12px;
                    border-bottom: 1px solid #f1f5f9;
                    color: #334155;
                }
                tbody td:last-child {
                    text-align: right;
                    font-weight: 600;
                    color: #1e1b4b;
                    font-family: 'Courier New', monospace;
                }
                tbody tr:nth-child(even) { background: #faf5ff; }
                tbody tr:hover { background: #f5f3ff; }

                .td-code { font-weight: 700; color: #6d28d9; font-family: 'Courier New', monospace; }
                .badge-borc {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    background: #fee2e2;
                    color: #991b1b;
                    font-weight: 700;
                    font-size: 10px;
                }
                .badge-alacak {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    background: #d1fae5;
                    color: #065f46;
                    font-weight: 700;
                    font-size: 10px;
                }

                /* Footer */
                .doc-footer {
                    margin-top: 28px;
                    padding-top: 14px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 9px;
                    color: #94a3b8;
                }

                /* Generic tree */
                .generic-tree {
                    font-family: 'Courier New', monospace;
                    font-size: 11px;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-break: break-word;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 20px;
                    border-radius: 8px;
                }
                .tag-name { color: #7c3aed; font-weight: bold; }
                .tag-value { color: #0369a1; }

                @media print {
                    body { padding: 0; }
                    .page { width: 100%; margin: 0; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
        <div class="page">
        `;


        const isBerat = xmlDoc.documentElement.nodeName.includes('berat');
        
        if (isBerat) {
            const getVal = (tagName) => {
                const el = xmlDoc.getElementsByTagName(tagName)[0] || xmlDoc.getElementsByTagNameNS('*', tagName.split(':').pop())[0];
                return el ? el.textContent : '-';
            };
            
            const orgName = getVal('gl-bus:organizationIdentifier');
            const periodStart = getVal('gl-cor:periodCoveredStart');
            const periodEnd = getVal('gl-cor:periodCoveredEnd');
            const description = getVal('gl-cor:entriesComment');
            const creator = getVal('gl-bus:creator');
            const createdDate = getVal('gl-cor:creationDate');
            const taxVkn = getVal('xbrli:identifier');
            const sourceApp = getVal('gl-bus:sourceApplication');
            const appName = sourceApp !== '-' ? sourceApp.split('##')[2] || sourceApp : '-';

            let ettNum = '-';
            let documentPeriod = '-';
            const uniqueIDs = Array.from(xmlDoc.getElementsByTagNameNS('*', 'uniqueID'));
            uniqueIDs.forEach(el => {
                const parentName = el.parentElement ? el.parentElement.localName : '';
                if (parentName === 'segment') {
                    ettNum = el.textContent;
                } else if (parentName === 'documentInfo') {
                    documentPeriod = el.textContent;
                }
            });

            const now = new Date().toLocaleDateString('tr-TR');
            
            htmlContent += `
            <div class="doc-header">
                <div class="doc-header-top">
                    <div>
                        <h1>e-Defter Berat Belgesi</h1>
                        <div class="subtitle">${escapeHtml(orgName)}</div>
                    </div>
                    <div class="doc-badge">GİB e-Defter</div>
                </div>
                <div class="header-divider"></div>
                <div class="doc-header-ids">
                    <div class="header-id-group">
                        <label>ETT Numarası</label>
                        <span>${escapeHtml(ettNum)}</span>
                    </div>
                    <div class="header-id-group">
                        <label>Dönem / Belge ID</label>
                        <span>${escapeHtml(documentPeriod)}</span>
                    </div>
                    <div class="header-id-group">
                        <label>VKN</label>
                        <span>${escapeHtml(taxVkn)}</span>
                    </div>
                </div>
            </div>

            <div class="doc-body">
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-card-header">Kurum ve Dönem Bilgileri</div>
                        <div class="info-card-body">
                            <div class="data-row">
                                <div class="data-label">Kurum Ünvanı</div>
                                <div class="data-value">${escapeHtml(orgName)}</div>
                            </div>
                            <div class="data-row">
                                <div class="data-label">Dönem Başlangıç</div>
                                <div class="data-value">${escapeHtml(periodStart)}</div>
                            </div>
                            <div class="data-row">
                                <div class="data-label">Dönem Bitiş</div>
                                <div class="data-value">${escapeHtml(periodEnd)}</div>
                            </div>
                            <div class="data-row">
                                <div class="data-label">Oluşturma Tarihi</div>
                                <div class="data-value">${escapeHtml(createdDate)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-header">Mali Müşavir / İmzalayan</div>
                        <div class="info-card-body">
                            <div class="data-row">
                                <div class="data-label">Müşavir Adı</div>
                                <div class="data-value">${escapeHtml(creator)}</div>
                            </div>
                            <div class="data-row">
                                <div class="data-label">Yazılım</div>
                                <div class="data-value">${escapeHtml(appName)}</div>
                            </div>
                            <div class="data-row">
                                <div class="data-label">Açıklama</div>
                                <div class="data-value">${escapeHtml(description)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            let entries = Array.from(xmlDoc.getElementsByTagNameNS('*', 'entryDetail'));
            if (entries.length === 0) {
                entries = Array.from(xmlDoc.getElementsByTagName('gl-cor:entryDetail'));
            }

            if(entries.length > 0) {
                htmlContent += `
                <div class="section-title">Hesap Hareketleri</div>
                <table>
                    <thead>
                        <tr>
                            <th>Hesap Kodu</th>
                            <th>Hesap Adı</th>
                            <th>B / A</th>
                            <th>Tutar (TL ₺)</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                entries.forEach(entry => {
                    const findChild = (localName) => Array.from(entry.getElementsByTagNameNS('*', localName))[0]?.textContent || 
                                                     Array.from(entry.getElementsByTagName('gl-cor:' + localName))[0]?.textContent || '-';
                    
                    const code = findChild('accountMainID');
                    const name = findChild('accountMainDescription');
                    const dc = findChild('debitCreditCode');
                    let amountStr = findChild('amount');
                    let formattedAmount = '-';
                    if(amountStr !== '-') {
                        const amount = Number.parseFloat(amountStr);
                        formattedAmount = Number.isFinite(amount)
                            ? amount.toLocaleString('tr-TR', {minimumFractionDigits: 2})
                            : '-';
                    }
                    const badge = dc === 'D' 
                        ? '<span class="badge-borc">Borç</span>' 
                        : '<span class="badge-alacak">Alacak</span>';
                    
                    htmlContent += `
                        <tr>
                            <td class="td-code">${escapeHtml(code)}</td>
                            <td>${escapeHtml(name)}</td>
                            <td>${badge}</td>
                            <td>${escapeHtml(formattedAmount)}</td>
                        </tr>
                    `;
                });
                
                htmlContent += `</tbody></table>`;
            }

            htmlContent += `
                <div class="doc-footer">
                    <span>GİB e-Defter Berat · Otomatik oluşturulmuştur</span>
                    <span>${now}</span>
                </div>
            </div>
            `;
            
        } else {
            htmlContent += `
            <div class="doc-body">
                <div class="section-title">Ham XML Veri Görüntüleyici</div>
                <p style="font-size:11px; color:#64748b; margin-bottom:12px;">Bu dosya için görsel şablon bulunamadı. Ham XML yapısı gösterilmektedir.</p>
                <div class="generic-tree">
            `;
            
            function nodeToHtml(node, indent) {
                let res = '';
                if (node.nodeType === 3) {
                    const txt = node.nodeValue.trim();
                    if (txt !== '') {
                        res += `<span class="tag-value">${escapeHtml(txt)}</span>\n`;
                    }
                } else if (node.nodeType === 1) {
                    const name = escapeHtml(node.nodeName);
                    const spaces = '&nbsp;'.repeat(indent);
                    res += `${spaces}<span class="tag-name">&lt;${name}&gt;</span>`;
                    
                    if(node.childNodes.length === 1 && node.childNodes[0].nodeType === 3) {
                        const val = node.childNodes[0].nodeValue.trim();
                        if(val) {
                            res += `<span class="tag-value">${escapeHtml(val)}</span>`;
                        }
                        res += `<span class="tag-name">&lt;/${name}&gt;</span>\n`;
                    } else {
                        res += `\n`;
                        for(let child of Array.from(node.childNodes)) {
                            res += nodeToHtml(child, indent + 4);
                        }
                        res += `${spaces}<span class="tag-name">&lt;/${name}&gt;</span>\n`;
                    }
                }
                return res;
            }
            
            htmlContent += nodeToHtml(xmlDoc.documentElement, 0);
            htmlContent += `</div></div>`;
        }

        htmlContent += `</div></body></html>`;
        return htmlContent;
    }

    function clearPreview() {
        currentRenderedHtml = '';
        invoiceFrame.srcdoc = '';
        invoiceFrame.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        
        if (!activeFileId) {
            fileInfoTitle.textContent = 'Görüntüleyici';
            fileInfoDesc.textContent = 'Ön izlemek için bir fatura seçin';
        }
        disableButtons();
    }

    function enableButtons() {
        btnPrint.disabled = false;
        btnDownloadPDF.disabled = false;
    }

    function disableButtons() {
        btnPrint.disabled = true;
        btnDownloadPDF.disabled = true;
    }

    // --- Actions ---
    function openPrintWindow() {
        if (!activeFileId || !currentRenderedHtml) return;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            alert('Popup engelleyici aktif. Lütfen bu site için popup izni verip tekrar deneyin.');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(injectPrintStyles(currentRenderedHtml));
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 350);
    }

    function createPdfRenderNode(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(injectPrintStyles(htmlString), 'text/html');
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-render-root';
        wrapper.setAttribute('aria-hidden', 'true');

        Object.assign(wrapper.style, {
            position: 'fixed',
            left: '-10000px',
            top: '0',
            width: '210mm',
            minHeight: '297mm',
            background: '#fff',
            zIndex: '-1'
        });

        doc.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
            wrapper.appendChild(node.cloneNode(true));
        });

        Array.from(doc.body.childNodes).forEach(node => {
            wrapper.appendChild(node.cloneNode(true));
        });

        document.body.appendChild(wrapper);
        return wrapper;
    }

    btnPrint.addEventListener('click', openPrintWindow);

    btnDownloadPDF.addEventListener('click', async () => {
        const file = getActiveFile();
        if (!file || !currentRenderedHtml) return;

        if (!window.html2pdf) {
            alert('PDF indirme bileşeni yüklenemedi. Yazdır ekranından "PDF olarak kaydet" seçeneğini kullanabilirsiniz.');
            openPrintWindow();
            return;
        }

        const originalLabel = btnDownloadPDF.innerHTML;
        btnDownloadPDF.disabled = true;
        btnDownloadPDF.innerHTML = '<i class="ph ph-spinner-gap"></i> Hazırlanıyor';
        fileInfoDesc.textContent = 'PDF hazırlanıyor...';

        const renderNode = createPdfRenderNode(currentRenderedHtml);

        try {
            await window.html2pdf()
                .set({
                    margin: 0,
                    filename: toPdfFilename(file.name),
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: false,
                        backgroundColor: '#ffffff'
                    },
                    jsPDF: {
                        unit: 'mm',
                        format: 'a4',
                        orientation: 'portrait'
                    },
                    pagebreak: {
                        mode: ['css', 'legacy']
                    }
                })
                .from(renderNode)
                .save();
        } catch (error) {
            console.error('PDF oluşturma hatası:', error);
            alert('PDF oluşturulamadı. Yazdır ekranından "PDF olarak kaydet" seçeneğini deneyebilirsiniz.');
            openPrintWindow();
        } finally {
            renderNode.remove();
            btnDownloadPDF.disabled = false;
            btnDownloadPDF.innerHTML = originalLabel;
            fileInfoDesc.textContent = 'Ön izleme aktif';
        }
    });





});
